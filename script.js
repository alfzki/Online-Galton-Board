document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('galtonBoardCanvas');
    const ctx = canvas.getContext('2d');

    const numRowsInput = document.getElementById('numRows');
    const numBallsInput = document.getElementById('numBalls');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const binCapacityInput = document.getElementById('binCapacity');

    // --- Base Configuration (values for unscaled design) ---
    let NUM_ROWS = parseInt(numRowsInput.value); // Initial value, updated on change
    const BASE_PEG_RADIUS = 6;
    const BASE_BALL_RADIUS = 5;
    const BASE_PEG_SPACING_X = 40;
    const BASE_PEG_SPACING_Y = 30;
    const BASE_START_Y_OFFSET = 30; // Y-coordinate of the center of the first row of pegs at base scale
    const BASE_DRAWN_BIN_HEIGHT = 60; // Visual height of the bin boxes at base scale
    const BASE_SPACE_BELOW_PEGS = BASE_PEG_SPACING_Y; // Space between last peg row and top of bins at base scale
    const BASE_BOTTOM_PADDING = 40;   // Padding below the bins at base scale

    const BALL_COLOR = '#2980b9';
    const PEG_COLOR = '#34495e';
    const BIN_COLOR = '#7f8c8d';
    const GRAVITY = 0.15;
    const BOUNCE_FACTOR = 0.1;
    const HORIZONTAL_BUMP = 1.5;

    // --- Scalable Configuration (will be updated by resizeCanvas) ---
    let currentPegSpacingX = BASE_PEG_SPACING_X;
    let currentPegSpacingY = BASE_PEG_SPACING_Y;
    let currentStartYOffset = BASE_START_Y_OFFSET;
    let currentPegRadius = BASE_PEG_RADIUS;
    let currentBallRadius = BASE_BALL_RADIUS;
    let currentDrawnBinHeight = BASE_DRAWN_BIN_HEIGHT;
    let currentSpaceBelowPegs = BASE_SPACE_BELOW_PEGS;
    let currentBottomPadding = BASE_BOTTOM_PADDING;
    let scaleFactor = 1;

    let pegs = [];
    let balls = [];
    let bins = [];
    let animationFrameId;
    let ballsBeingDropped = 0;
    let ballsToDropTotal = 0;
    let dropIntervalId;

    const CANVAS_MARGIN_LEFT = 10;
    const CANVAS_MARGIN_RIGHT = 10;

    // --- Utility Functions ---
    function resizeCanvas() {
        NUM_ROWS = parseInt(numRowsInput.value);

        const viewportWidth = window.innerWidth;
        const availableWidthForCanvasElement = viewportWidth - CANVAS_MARGIN_LEFT - CANVAS_MARGIN_RIGHT;
        const idealContentWidthUnscaled = (NUM_ROWS + 3.5) * BASE_PEG_SPACING_X;

        let finalCanvasWidth;
        if (idealContentWidthUnscaled > availableWidthForCanvasElement) {
            finalCanvasWidth = availableWidthForCanvasElement;
        } else {
            finalCanvasWidth = idealContentWidthUnscaled;
        }
        
        currentPegSpacingX = finalCanvasWidth / (NUM_ROWS + 3.5);
        // Ensure currentPegSpacingX doesn't get too small, adjust finalCanvasWidth accordingly if it does.
        const minPegSpacingX = BASE_PEG_RADIUS * 3; // Minimum spacing based on base radius
        if (currentPegSpacingX < minPegSpacingX) {
            currentPegSpacingX = minPegSpacingX;
            finalCanvasWidth = (NUM_ROWS + 3.5) * currentPegSpacingX;
        }
        
        scaleFactor = currentPegSpacingX / BASE_PEG_SPACING_X;

        currentPegSpacingY = BASE_PEG_SPACING_Y * scaleFactor;
        currentStartYOffset = BASE_START_Y_OFFSET * scaleFactor;
        currentPegRadius = BASE_PEG_RADIUS * scaleFactor;
        currentBallRadius = BASE_BALL_RADIUS * scaleFactor;
        currentDrawnBinHeight = BASE_DRAWN_BIN_HEIGHT * scaleFactor;
        currentSpaceBelowPegs = BASE_SPACE_BELOW_PEGS * scaleFactor;
        currentBottomPadding = BASE_BOTTOM_PADDING * scaleFactor;

        canvas.width = finalCanvasWidth;
        canvas.height = currentStartYOffset + // To center of first peg row
                        (NUM_ROWS - 1) * currentPegSpacingY + // From first to last peg row center
                        currentPegRadius + // Bottom edge of the last peg row
                        currentSpaceBelowPegs + // Space between pegs and bins
                        currentDrawnBinHeight + // Height of the bin drawings
                        currentBottomPadding;   // Padding at the very bottom
        
        canvas.style.maxWidth = finalCanvasWidth + 'px';
    }

    // --- Initialization ---
    function initPegs() {
        pegs = [];
        // currentStartYOffset is the Y for the center of the first row of pegs
        const firstPegRowCenterY = currentStartYOffset;
        for (let row = 0; row < NUM_ROWS; row++) {
            const numPegsInRow = row + 1;
            const rowWidth = (numPegsInRow - 1) * currentPegSpacingX;
            const startX = (canvas.width - rowWidth) / 2;
            for (let col = 0; col < numPegsInRow; col++) {
                pegs.push({
                    x: startX + col * currentPegSpacingX,
                    y: firstPegRowCenterY + row * currentPegSpacingY,
                    radius: currentPegRadius
                });
            }
        }
    }

    function initBins() {
        bins = [];
        const numBins = NUM_ROWS + 1;
        const binWidth = currentPegSpacingX;

        const lastPegRowCenterY = currentStartYOffset + (NUM_ROWS - 1) * currentPegSpacingY;
        const binsTopY = lastPegRowCenterY + currentPegRadius + currentSpaceBelowPegs;

        const totalBinsWidth = numBins * binWidth;
        const firstBinX = (canvas.width - totalBinsWidth) / 2;

        for (let i = 0; i < numBins; i++) {
            bins.push({
                x: firstBinX + i * binWidth,
                y: binsTopY,
                width: binWidth,
                height: currentDrawnBinHeight,
                count: 0,
                maxCapacity: parseInt(binCapacityInput.value) || 100
            });
        }
    }

    function createBall() {
        const firstPegX = pegs.length > 0 ? pegs[0].x : canvas.width / 2;
        // Start ball above the center of the first peg row
        return {
            x: firstPegX,
            y: currentStartYOffset - currentPegSpacingY, // Start one scaled spacing above first row center
            radius: currentBallRadius,
            color: BALL_COLOR,
            vx: (Math.random() - 0.5) * 0.5,
            vy: 0,
            landed: false
        };
    }

    // --- Drawing Functions ---
    function drawPegs() {
        ctx.fillStyle = PEG_COLOR;
        pegs.forEach(peg => {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawBalls() {
        balls.forEach(ball => {
            if (ball.landed) return;
            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawBins() {
        ctx.strokeStyle = BIN_COLOR;
        ctx.fillStyle = '#ecf0f1'; 

        bins.forEach(bin => {
            ctx.beginPath();
            ctx.rect(bin.x, bin.y, bin.width, bin.height);
            ctx.stroke();

            if (bin.count > 0 && bin.maxCapacity > 0) {
                const barFillHeight = (bin.count / bin.maxCapacity) * bin.height;
                ctx.fillStyle = BALL_COLOR;
                ctx.fillRect(
                    bin.x + 1,
                    bin.y + bin.height - Math.min(barFillHeight, bin.height - 1),
                    bin.width - 2,
                    Math.min(barFillHeight, bin.height - 1)
                );
            }

            ctx.fillStyle = '#333';
            ctx.font = (10 * scaleFactor) + 'px Arial'; // Scale font size
            ctx.textAlign = 'center';
            ctx.fillText(bin.count, bin.x + bin.width / 2, bin.y - (5 * scaleFactor)); // Scale text offset
        });
    }

    // --- Animation and Physics ---
    function updateBalls() {
        balls.forEach(ball => {
            if (ball.landed) return;

            ball.vy += GRAVITY * scaleFactor; // Scale gravity effect if desired, or keep constant
            ball.x += ball.vx * scaleFactor; // Scale velocity effect
            ball.y += ball.vy * scaleFactor; // Scale velocity effect

            pegs.forEach(peg => {
                const dx = ball.x - peg.x;
                const dy = ball.y - peg.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < ball.radius + peg.radius) {
                    ball.y = peg.y - (ball.radius + peg.radius) * Math.sign(dy) * 0.51; // Simplified collision response
                    ball.vy *= -BOUNCE_FACTOR;
                    
                    const bump = HORIZONTAL_BUMP * scaleFactor; // Scale bump
                    if (ball.x < peg.x) {
                        ball.vx = -bump * Math.random();
                    } else {
                        ball.vx = bump * Math.random();
                    }
                    if (Math.abs(ball.vx) < 0.5 * scaleFactor) ball.vx = (ball.x < peg.x ? -1 : 1) * 0.5 * scaleFactor;
                }
            });

            if (bins.length > 0 && ball.y + ball.radius > bins[0].y) {
                for (let i = 0; i < bins.length; i++) {
                    const bin = bins[i];
                    if (ball.x > bin.x && ball.x < bin.x + bin.width && ball.y + ball.radius > bin.y) {
                        if (!ball.landed) {
                            if (bin.count < bin.maxCapacity) { // Check against logical capacity
                                bin.count++;
                                ball.landed = true;
                                ballsBeingDropped--;
                            } else { // Bin is full, ball might bounce off or disappear
                                ball.vy *= -BOUNCE_FACTOR * 0.5; // Bounce less
                                ball.y = bin.y - ball.radius; 
                            }
                        }
                        break; 
                    }
                }
                if (!ball.landed && ball.y + ball.radius > canvas.height) {
                     ball.landed = true; 
                     ballsBeingDropped--;
                }
            }

            if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
                ball.vx *= -0.5; 
                if (ball.x - ball.radius < 0) ball.x = ball.radius;
                if (ball.x + ball.radius > canvas.width) ball.x = canvas.width - ball.radius;
            }
        });
    }

    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPegs();
        drawBalls();
        updateBalls();
        drawBins();

        if (ballsBeingDropped > 0 || balls.some(ball => !ball.landed)) {
            animationFrameId = requestAnimationFrame(gameLoop);
        } else {
            stopSimulation();
        }
    }

    function startSimulation() {
        if (animationFrameId) return;
        NUM_ROWS = parseInt(numRowsInput.value);
        ballsToDropTotal = parseInt(numBallsInput.value);

        // ... (Input validations)

        resizeCanvas();
        initPegs();
        initBins();
        balls = [];
        ballsBeingDropped = 0;

        startButton.disabled = true;
        numRowsInput.disabled = true;
        numBallsInput.disabled = true;
        binCapacityInput.disabled = true;
        resetButton.disabled = false;

        let ballsDroppedThisSession = 0;
        function tryDropBall() {
            if (ballsDroppedThisSession < ballsToDropTotal) {
                const newBall = createBall();
                balls.push(newBall);
                ballsBeingDropped++;
                ballsDroppedThisSession++;
            } else {
                clearInterval(dropIntervalId);
                dropIntervalId = null;
            }
        }
        const dropDelay = Math.max(50, 200 - ballsToDropTotal * 0.1); // Faster for more balls
        dropIntervalId = setInterval(tryDropBall, dropDelay);
        tryDropBall(); 

        gameLoop();
    }

    function stopSimulation() {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (dropIntervalId) {
            clearInterval(dropIntervalId);
            dropIntervalId = null;
        }
        startButton.disabled = false;
        numRowsInput.disabled = false;
        numBallsInput.disabled = false;
        binCapacityInput.disabled = false;
    }

    function resetSimulation() {
        stopSimulation();
        balls = [];
        ballsBeingDropped = 0;
        ballsToDropTotal = 0;
        NUM_ROWS = parseInt(numRowsInput.value);
        
        resizeCanvas(); // Recalculate all scaled dimensions
        initPegs();
        initBins();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPegs();
        drawBins();

        startButton.disabled = false;
        numRowsInput.disabled = false;
        numBallsInput.disabled = false;
        binCapacityInput.disabled = false;
        resetButton.disabled = true;
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', startSimulation);
    resetButton.addEventListener('click', resetSimulation);
    numRowsInput.addEventListener('change', () => { if (!animationFrameId) resetSimulation(); });
    numBallsInput.addEventListener('change', () => { /* No reset needed, used at start */ });
    binCapacityInput.addEventListener('change', () => { if (!animationFrameId) resetSimulation(); });
    window.addEventListener('resize', () => { if (!animationFrameId) resetSimulation(); });

    // --- Initial Setup Call ---
    resetSimulation();
});