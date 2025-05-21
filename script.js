document.addEventListener('DOMContentLoaded', () => {
    // DOM element references
    const canvas = document.getElementById('galtonBoardCanvas');
    const ctx = canvas.getContext('2d');
    const numRowsInput = document.getElementById('numRows');
    const numBallsInput = document.getElementById('numBalls');
    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    const binCapacityInput = document.getElementById('binCapacity');

    // --- Base Configuration (Default values for an unscaled Galton board design) ---
    // These constants define the initial dimensions and appearance of the board elements
    // before any scaling is applied based on canvas size.
    let NUM_ROWS = parseInt(numRowsInput.value); // Number of peg rows, dynamically updated.
    const BASE_PEG_RADIUS = 6; // Default radius of a single peg.
    const BASE_BALL_RADIUS = 5; // Default radius of a single ball.
    const BASE_PEG_SPACING_X = 40; // Default horizontal distance between centers of adjacent pegs.
    const BASE_PEG_SPACING_Y = 30; // Default vertical distance between centers of peg rows.
    const BASE_START_Y_OFFSET = 30; // Default vertical offset from the canvas top to the first peg row.
    const BASE_DRAWN_BIN_HEIGHT = 60; // Default visual height of the bins.
    const BASE_SPACE_BELOW_PEGS = BASE_PEG_SPACING_Y; // Default vertical space between the last peg row and the top of the bins.
    const BASE_BOTTOM_PADDING = 40; // Default padding at the very bottom of the canvas.

    // --- Physics Constants ---
    // These constants control the behavior of balls during the simulation.
    // Values are fine-tuned to achieve a visually plausible simulation.
    const BALL_COLOR = '#2980b9'; // Color for the balls.
    const PEG_COLOR = '#34495e'; // Color for the pegs.
    const BIN_COLOR = '#7f8c8d'; // Color for the bin outlines.
    const GRAVITY = 0.15; // Acceleration due to gravity, affecting ball's vertical speed.
    const BOUNCE_FACTOR = 0.1; // Coefficient of restitution for ball collisions (lower value means less bounce).
    const HORIZONTAL_BUMP = 1.5; // Magnitude of horizontal velocity change upon hitting a peg.

    // --- Scalable Configuration (Dynamically adjusted based on canvas size and NUM_ROWS) ---
    // These variables store the current, scaled dimensions and properties of board elements.
    // They are recalculated when the canvas is resized or NUM_ROWS changes.
    let currentPegSpacingX = BASE_PEG_SPACING_X;
    let currentPegSpacingY = BASE_PEG_SPACING_Y;
    let currentStartYOffset = BASE_START_Y_OFFSET;
    let currentPegRadius = BASE_PEG_RADIUS;
    let currentBallRadius = BASE_BALL_RADIUS;
    let currentDrawnBinHeight = BASE_DRAWN_BIN_HEIGHT;
    let currentSpaceBelowPegs = BASE_SPACE_BELOW_PEGS;
    let currentBottomPadding = BASE_BOTTOM_PADDING;
    let scaleFactor = 1; // Factor by which base dimensions are scaled.

    // Simulation state variables
    let pegs = []; // Array to store peg objects.
    let balls = []; // Array to store ball objects.
    let bins = []; // Array to store bin objects.
    let animationFrameId; // ID for the requestAnimationFrame loop, used to stop the animation.
    let ballsBeingDropped = 0; // Counter for balls currently in motion and not yet settled.
    let ballsToDropTotal = 0; // Total number of balls to be dropped in the current simulation.
    let dropIntervalId; // ID for the setInterval used to stagger ball drops.

    // Canvas layout constants
    const CANVAS_MARGIN_LEFT = 10; // Left margin for the canvas within the viewport.
    const CANVAS_MARGIN_RIGHT = 10; // Right margin for the canvas within the viewport.

    // --- Physics Helper Functions ---

    /**
     * Applies gravity to a ball and updates its position based on its velocity.
     * @param {object} ball - The ball object to update.
     */
    function applyBallPhysics(ball) {
        ball.vy += GRAVITY * scaleFactor; // Apply scaled gravity to vertical velocity.
        ball.x += ball.vx; // Update horizontal position.
        ball.y += ball.vy; // Update vertical position.
    }

    /**
     * Handles collisions between a ball and the canvas walls.
     * Reverses and dampens velocity upon collision.
     * @param {object} ball - The ball object to check for wall collisions.
     */
    function handleBallWallCollisions(ball) {
        // Horizontal wall collisions (left and right)
        if (ball.x - currentBallRadius < 0 || ball.x + currentBallRadius > canvas.width) {
            ball.vx *= -0.5; // Reverse and dampen horizontal velocity.
            // Reposition ball to prevent sticking to the wall.
            if (ball.x - currentBallRadius < 0) ball.x = currentBallRadius;
            if (ball.x + currentBallRadius > canvas.width) ball.x = canvas.width - currentBallRadius;
        }

        // Bottom wall collision (ball falls off screen)
        // Also checks if the ball is not already settling or landed to avoid redundant processing.
        if (ball.y - currentBallRadius > canvas.height && !ball.isSettling && !ball.landed) {
            ball.landed = true; // Mark ball as lost/landed off-screen.
            ballsBeingDropped--; // Decrement count of active balls.
        }
        // Top wall collision (less common, but included for completeness)
        if (ball.y - currentBallRadius < 0) {
            ball.vy *= -BOUNCE_FACTOR; // Reverse and dampen vertical velocity using the global bounce factor.
            ball.y = currentBallRadius; // Reposition ball to prevent sticking.
        }
    }

    /**
     * Handles collisions between a ball and the pegs.
     * Implements a simplified bounce logic upon collision.
     * @param {object} ball - The ball object to check for peg collisions.
     */
    function handleBallPegCollisions(ball) {
        pegs.forEach(peg => {
            const dx = ball.x - peg.x; // Difference in x-coordinates.
            const dy = ball.y - peg.y; // Difference in y-coordinates.
            const distance = Math.sqrt(dx * dx + dy * dy); // Distance between ball and peg centers.

            // Check if the ball is colliding with the peg.
            if (distance < currentBallRadius + currentPegRadius) {
                // Approximate collision response:
                // Nudge the ball slightly away from the peg to prevent sticking.
                ball.y = peg.y - (currentBallRadius + currentPegRadius) * Math.sign(dy) * 0.51;

                // Reverse and dampen vertical velocity.
                ball.vy *= -BOUNCE_FACTOR;

                // Apply a horizontal "bump" with a random component.
                const bump = HORIZONTAL_BUMP * scaleFactor;
                if (ball.x < peg.x) { // Ball hits peg from the left.
                    ball.vx = -bump * Math.random();
                } else { // Ball hits peg from the right.
                    ball.vx = bump * Math.random();
                }

                // Ensure a minimum horizontal velocity after collision to prevent stalling.
                if (Math.abs(ball.vx) < 0.5 * scaleFactor) {
                     ball.vx = (ball.x < peg.x ? -1 : 1) * 0.5 * scaleFactor;
                }
            }
        });
    }

    /**
     * Handles interactions between a ball and the bins.
     * If a bin has capacity, the ball settles into it. If full, the ball bounces off.
     * @param {object} ball - The ball object to check for bin interactions.
     */
    function handleBallBinInteractions(ball) {
        // Skip if no bins, or ball is already settling or landed.
        if (bins.length === 0 || ball.isSettling || ball.landed) {
            return;
        }

        const bottomOfBall = ball.y + currentBallRadius;
        const topOfBins = bins[0].y; // Assuming all bins are at the same y-level.

        // Check if the ball is vertically within the bin area.
        if (bottomOfBall >= topOfBins && ball.y - currentBallRadius < topOfBins + currentDrawnBinHeight) {
            for (let i = 0; i < bins.length; i++) {
                const bin = bins[i];
                // Check if the ball horizontally overlaps with the current bin.
                const ballOverlapsBinHorizontally = ball.x + currentBallRadius > bin.x && ball.x - currentBallRadius < bin.x + bin.width;

                if (ballOverlapsBinHorizontally) {
                    // Ensure the bottom of the ball is at or below the bin's top edge.
                    if (ball.y + currentBallRadius >= bin.y) {
                        if (bin.count < bin.maxCapacity) { // Bin has space.
                            bin.count++;
                            ballsBeingDropped--;
                            ball.isSettling = true; // Mark ball as settling.
                            ball.vx = 0; // Stop horizontal movement.
                            ball.vy = 0; // Stop vertical movement.
                            ball.x = bin.x + bin.width / 2; // Center ball in the bin.
                            // Position ball at the visual bottom of the collected balls in the bin.
                            ball.y = bin.y + bin.height - currentBallRadius - 1;
                        } else { // Bin is full.
                            // Make the ball bounce off the full bin.
                            ball.vy *= -BOUNCE_FACTOR * 0.5; // Reduced bounce compared to pegs.
                            ball.y = bin.y - currentBallRadius - 0.1; // Position slightly above the bin.
                            // Give a small horizontal nudge if velocity is too low.
                            if (Math.abs(ball.vx) < 0.1 * scaleFactor) {
                                ball.vx = (Math.random() < 0.5 ? -1 : 1) * 0.2 * scaleFactor;
                            }
                        }
                        return; // Ball has interacted with a bin, no need to check others.
                    }
                }
            }
        }
    }

    /**
     * Resizes the canvas and recalculates all scalable dimensions based on viewport width and number of rows.
     * This function ensures the Galton board is responsive.
     */
    function resizeCanvas() {
        NUM_ROWS = parseInt(numRowsInput.value); // Update NUM_ROWS from input.

        const viewportWidth = window.innerWidth;
        // Calculate available width for the canvas element, considering margins.
        const availableWidthForCanvasElement = viewportWidth - CANVAS_MARGIN_LEFT - CANVAS_MARGIN_RIGHT;
        // Calculate the ideal width the content would take if unscaled.
        const idealContentWidthUnscaled = (NUM_ROWS + 3.5) * BASE_PEG_SPACING_X;

        let finalCanvasWidth;
        // If ideal unscaled width is larger than available, use available width.
        if (idealContentWidthUnscaled > availableWidthForCanvasElement) {
            finalCanvasWidth = availableWidthForCanvasElement;
        } else { // Otherwise, use the ideal unscaled width.
            finalCanvasWidth = idealContentWidthUnscaled;
        }
        
        // Calculate the horizontal spacing for pegs based on the final canvas width.
        currentPegSpacingX = finalCanvasWidth / (NUM_ROWS + 3.5);
        // Ensure a minimum peg spacing to prevent visual clutter or overlap.
        const minPegSpacingX = BASE_PEG_RADIUS * 3;
        if (currentPegSpacingX < minPegSpacingX) {
            currentPegSpacingX = minPegSpacingX;
            // Recalculate canvas width if minimum spacing forces it to be larger.
            finalCanvasWidth = (NUM_ROWS + 3.5) * currentPegSpacingX;
        }
        
        // Determine the scale factor based on the new peg spacing relative to the base.
        scaleFactor = currentPegSpacingX / BASE_PEG_SPACING_X;

        // Apply the scale factor to all other base dimensions.
        currentPegSpacingY = BASE_PEG_SPACING_Y * scaleFactor;
        currentStartYOffset = BASE_START_Y_OFFSET * scaleFactor;
        currentPegRadius = BASE_PEG_RADIUS * scaleFactor;
        currentBallRadius = BASE_BALL_RADIUS * scaleFactor;
        currentDrawnBinHeight = BASE_DRAWN_BIN_HEIGHT * scaleFactor;
        currentSpaceBelowPegs = BASE_SPACE_BELOW_PEGS * scaleFactor;
        currentBottomPadding = BASE_BOTTOM_PADDING * scaleFactor;

        // Set the canvas dimensions.
        canvas.width = finalCanvasWidth;
        canvas.height = currentStartYOffset +
                        (NUM_ROWS - 1) * currentPegSpacingY +
                        currentPegRadius + // Account for the radius of the last row of pegs.
                        currentSpaceBelowPegs +
                        currentDrawnBinHeight +
                        currentBottomPadding;
        
        // Set CSS max-width to ensure canvas doesn't exceed its calculated width.
        canvas.style.maxWidth = finalCanvasWidth + 'px';
    }

    /**
     * Initializes or re-initializes the peg positions based on the current canvas dimensions and number of rows.
     * Pegs are arranged in a triangular pattern.
     */
    function initPegs() {
        pegs = []; // Clear existing pegs.
        const firstPegRowCenterY = currentStartYOffset; // Y-coordinate for the center of the first peg row.

        for (let row = 0; row < NUM_ROWS; row++) {
            const numPegsInRow = row + 1; // Number of pegs in the current row.
            const rowWidth = (numPegsInRow - 1) * currentPegSpacingX; // Total width occupied by pegs in this row.
            const startX = (canvas.width - rowWidth) / 2; // Starting X-coordinate to center the row.

            for (let col = 0; col < numPegsInRow; col++) {
                pegs.push({
                    x: startX + col * currentPegSpacingX,
                    y: firstPegRowCenterY + row * currentPegSpacingY,
                    radius: currentPegRadius
                });
            }
        }
    }

    /**
     * Initializes or re-initializes the bins at the bottom of the Galton board.
     * The number of bins is typically NUM_ROWS + 1.
     */
    function initBins() {
        bins = []; // Clear existing bins.
        const numBins = NUM_ROWS + 1;
        const binWidth = currentPegSpacingX; // Each bin's width matches the horizontal peg spacing.

        // Calculate the Y-coordinate for the top of the bins.
        const lastPegRowCenterY = currentStartYOffset + (NUM_ROWS - 1) * currentPegSpacingY;
        const binsTopY = lastPegRowCenterY + currentPegRadius + currentSpaceBelowPegs;

        const totalBinsWidth = numBins * binWidth; // Total width occupied by all bins.
        const firstBinX = (canvas.width - totalBinsWidth) / 2; // Starting X-coordinate to center the bins.

        for (let i = 0; i < numBins; i++) {
            bins.push({
                x: firstBinX + i * binWidth,
                y: binsTopY,
                width: binWidth,
                height: currentDrawnBinHeight,
                count: 0, // Number of balls currently in this bin.
                maxCapacity: parseInt(binCapacityInput.value) || 100 // Max capacity from input, default 100.
            });
        }
    }

    /**
     * Creates a new ball object with initial properties.
     * Balls are typically created above the first peg.
     * @returns {object} A new ball object.
     */
    function createBall() {
        // Start ball above the center of the first row of pegs, or canvas center if no pegs.
        const firstPegX = pegs.length > 0 ? pegs[0].x : canvas.width / 2;
        return {
            x: firstPegX,
            y: currentStartYOffset - currentPegSpacingY, // Position above the first peg row.
            radius: currentBallRadius,
            color: BALL_COLOR,
            vx: (Math.random() - 0.5) * 0.5, // Small initial random horizontal velocity.
            vy: 0, // Initial vertical velocity.
            landed: false, // True if the ball has settled in a bin or fallen off.
            isSettling: false // True if the ball is in the process of settling into a bin.
        };
    }

    // --- Drawing Functions ---

    /**
     * Draws all pegs on the canvas.
     */
    function drawPegs() {
        ctx.fillStyle = PEG_COLOR;
        pegs.forEach(peg => {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2); // Draw a circle for each peg.
            ctx.fill();
        });
    }

    /**
     * Draws all active (non-settled, non-landed) balls on the canvas.
     * Balls that are settling or have landed are not drawn individually;
     * their presence is represented by the bin fill level.
     */
    function drawBalls() {
        balls.forEach(ball => {
            // Do not draw balls that have landed or are in the process of settling.
            if (ball.landed || ball.isSettling) return;

            ctx.fillStyle = ball.color;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); // Draw a circle for each ball.
            ctx.fill();
        });
    }

    /**
     * Draws the bins and the visual representation of balls collected in them.
     * Also displays the count of balls in each bin.
     */
    function drawBins() {
        ctx.strokeStyle = BIN_COLOR; // Color for bin outlines.
        ctx.fillStyle = '#ecf0f1'; // A light background color for bin internals (optional).

        bins.forEach(bin => {
            // Draw bin outline.
            ctx.beginPath();
            ctx.rect(bin.x, bin.y, bin.width, bin.height);
            ctx.stroke();

            // Draw the fill level for collected balls if any.
            if (bin.count > 0 && bin.maxCapacity > 0) {
                // Calculate the height of the bar representing collected balls.
                const barFillHeight = (bin.count / bin.maxCapacity) * bin.height;
                ctx.fillStyle = BALL_COLOR; // Use ball color for the fill.
                ctx.fillRect(
                    bin.x + 1, // Small offset for visual padding.
                    // Y-position of the top of the fill bar.
                    bin.y + bin.height - Math.min(barFillHeight, bin.height - 1),
                    bin.width - 2, // Reduce width slightly for padding.
                    // Actual height of the fill bar, capped at bin height.
                    Math.min(barFillHeight, bin.height - 1)
                );
            }

            // Draw the count of balls above each bin.
            ctx.fillStyle = '#333'; // Text color.
            ctx.font = (10 * scaleFactor) + 'px Arial'; // Scale font size.
            ctx.textAlign = 'center';
            ctx.fillText(bin.count, bin.x + bin.width / 2, bin.y - (5 * scaleFactor)); // Position text above bin.
        });
    }

    // --- Main Animation Loop and Controls ---

    /**
     * Updates the state of all balls for each frame of the animation.
     * This function orchestrates the physics calculations for each ball.
     */
    function updateBalls() {
        balls.forEach(ball => {
            if (ball.landed) return; // Skip already landed balls.

            if (ball.isSettling) {
                // If a ball was marked as 'isSettling' in the previous frame (e.g., by handleBallBinInteractions),
                // finalize its state to 'landed' for the current frame.
                // This prevents it from being drawn or processed further as an active ball.
                ball.landed = true;
                return;
            }

            applyBallPhysics(ball); // Apply gravity and update position.
            handleBallWallCollisions(ball); // Check and handle wall collisions.

            // Re-check if landed, as wall collision (e.g., falling off bottom) might have changed state.
            if (ball.landed) return;

            handleBallPegCollisions(ball); // Check and handle peg collisions.
            handleBallBinInteractions(ball); // Check and handle bin interactions (settling or bouncing).
        });
    }

    /**
     * The main game loop, called repeatedly using requestAnimationFrame.
     * Clears the canvas, draws all elements, updates ball states, and requests the next frame.
     */
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas for redrawing.
        drawPegs();
        drawBalls(); // Draw balls before updating, so their current position is rendered.
        updateBalls(); // Update ball physics and interactions.
        drawBins(); // Draw bins, which might reflect changes from updateBalls (e.g., new counts).

        // Continue animation if there are balls being dropped or any ball has not yet landed.
        if (ballsBeingDropped > 0 || balls.some(ball => !ball.landed)) {
            animationFrameId = requestAnimationFrame(gameLoop);
        } else {
            // All balls have landed or simulation ended.
            stopSimulation(); // Clean up animation resources.
        }
    }

    /**
     * Validates user inputs for number of rows, balls, and bin capacity.
     * @param {number} numRows - Number of peg rows.
     * @param {number} numBalls - Number of balls to drop.
     * @param {number} binCapacity - Maximum capacity of each bin.
     * @returns {boolean} True if all inputs are valid, false otherwise.
     */
    function validateInputs(numRows, numBalls, binCapacity) {
        if (isNaN(numRows) || numRows < 1 || numRows > 30) {
            alert("Number of rows must be between 1 and 30.");
            return false;
        }
        if (isNaN(numBalls) || numBalls < 1 || numBalls > 5000) {
            alert("Number of balls must be between 1 and 5000.");
            return false;
        }
        if (isNaN(binCapacity) || binCapacity < 1 || binCapacity > 1000) {
            alert("Bin capacity must be between 1 and 1000.");
            return false;
        }
        return true;
    }

    // --- Simulation Control Functions ---

    /**
     * Starts the Galton board simulation.
     * Initializes the board, balls, and starts the animation loop.
     * Disables input fields during simulation.
     */
    function startSimulation() {
        if (animationFrameId) return; // Prevent starting if already running.

        // Get and validate user inputs.
        NUM_ROWS = parseInt(numRowsInput.value);
        ballsToDropTotal = parseInt(numBallsInput.value);
        const binCapacityVal = parseInt(binCapacityInput.value);

        if (!validateInputs(NUM_ROWS, ballsToDropTotal, binCapacityVal)) {
            return; // Stop if inputs are invalid.
        }

        // Prepare the simulation environment.
        resizeCanvas(); // Adjust canvas and element sizes.
        initPegs(); // Set up pegs.
        initBins(); // Set up bins.
        balls = []; // Clear any existing balls.
        ballsBeingDropped = 0; // Reset active ball counter.

        // Update UI state.
        startButton.disabled = true;
        numRowsInput.disabled = true;
        numBallsInput.disabled = true;
        binCapacityInput.disabled = true;
        resetButton.disabled = false;

        let ballsDroppedThisSession = 0;
        /**
         * Attempts to drop a new ball if the total count for the session hasn't been reached.
         */
        function tryDropBall() {
            if (ballsDroppedThisSession < ballsToDropTotal) {
                const newBall = createBall();
                balls.push(newBall);
                ballsBeingDropped++;
                ballsDroppedThisSession++;
            } else {
                // All balls for this session have been initiated.
                clearInterval(dropIntervalId);
                dropIntervalId = null;
            }
        }
        // Calculate delay for dropping balls to prevent all balls appearing at once.
        // Delay is shorter for more balls, with min/max caps.
        const dropDelay = Math.max(10, Math.min(100, 50000 / ballsToDropTotal));
        dropIntervalId = setInterval(tryDropBall, dropDelay);
        tryDropBall(); // Drop the first ball immediately.

        gameLoop(); // Start the animation.
    }

    /**
     * Stops the current simulation.
     * Cancels the animation frame and ball drop interval.
     * Re-enables input fields.
     */
    function stopSimulation() {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (dropIntervalId) {
            clearInterval(dropIntervalId);
            dropIntervalId = null;
        }
        // Re-enable UI controls.
        startButton.disabled = false;
        numRowsInput.disabled = false;
        numBallsInput.disabled = false;
        binCapacityInput.disabled = false;
    }

    /**
     * Resets the Galton board to its initial state.
     * Stops any ongoing simulation, clears balls, re-initializes pegs and bins,
     * and redraws the static board.
     */
    function resetSimulation() {
        stopSimulation(); // Ensure any active simulation is stopped.
        balls = [];
        ballsBeingDropped = 0;
        ballsToDropTotal = 0;

        // Re-initialize and draw the board components.
        resizeCanvas(); // Recalculate dimensions based on current inputs.
        initPegs();
        initBins();

        // Clear the canvas and draw the static elements.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPegs();
        drawBins();

        // Reset UI button states.
        startButton.disabled = false;
        numRowsInput.disabled = false;
        numBallsInput.disabled = false;
        binCapacityInput.disabled = false;
        resetButton.disabled = true; // Reset button is typically disabled until a simulation starts.
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', startSimulation);
    resetButton.addEventListener('click', resetSimulation);

    // When input values change and simulation is not running, reset the board to reflect changes.
    numRowsInput.addEventListener('change', () => {
        NUM_ROWS = parseInt(numRowsInput.value); // Update global NUM_ROWS
        if (!animationFrameId) resetSimulation(); // Reset if not currently simulating.
    });
    numBallsInput.addEventListener('change', () => { /* No immediate reset needed, value used at start */ });
    binCapacityInput.addEventListener('change', () => {
        if (!animationFrameId) resetSimulation(); // Reset if not currently simulating.
    });
    window.addEventListener('resize', () => {
        if (!animationFrameId) resetSimulation(); // Reset on window resize if not simulating.
    });

    // --- Initial Setup Call ---
    // Perform an initial reset to draw the board when the page loads.
    resetSimulation();
});