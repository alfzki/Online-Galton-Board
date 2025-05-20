# Online Galton Board Simulation

This web application simulates a Galton Board, a device invented by Sir Francis Galton to demonstrate the central limit theorem and the normal distribution. Balls are dropped from the top and bounce off pegs, eventually settling into bins at the bottom.

## How it Works

The simulation visualizes the process of balls falling through a triangular array of pegs. Each time a ball hits a peg, it has an equal probability of bouncing left or right. This random process leads to a binomial distribution of balls in the bins, which approximates a normal distribution as the number of balls and rows increases.

## Features

- **Interactive Controls:** Adjust the simulation parameters in real-time (when the simulation is not running).
- **Responsive Design:** The layout adapts to different screen sizes, making it usable on desktop and mobile devices.
- **Visual Feedback:** Watch the balls drop and accumulate in the bins.

## Using the Simulation

### Controls

Located at the top of the page, these input fields allow you to customize the simulation:

1.  **Number of Rows:**

    - Determines the number of horizontal rows of pegs in the Galton Board.
    - Accepts values between 2 and 20.
    - Changing this value will reset the simulation and redraw the board.

2.  **Number of Balls:**

    - Sets the total number of balls to be dropped.
    - Accepts values between 10 and 1000.
    - This value is used when the "Drop Balls" button is pressed.

3.  **Bin Capacity:**
    - Defines the maximum number of balls each bin at the bottom can visually represent before appearing "full" in terms of its fill bar. The actual count can exceed this.
    - Accepts values between 50 and 300.
    - Changing this value will reset the simulation to update the bin appearance.

### Buttons

1.  **Drop Balls:**

    - Starts the simulation.
    - Balls will begin to drop from the top of the board, one by one, at a set interval.
    - The input controls (Number of Rows, Number of Balls, Bin Capacity) are disabled while the simulation is running.

2.  **Reset:**
    - Stops the current simulation (if running).
    - Clears all balls from the board and resets the counts in the bins.
    - Re-enables the input controls.
    - The board is redrawn according to the current "Number of Rows" and "Bin Capacity" values.

## Technical Details

- The simulation is built using HTML, CSS, and JavaScript.
- The animation is rendered on an HTML5 Canvas element.
- The physics of the ball movement and collisions are simplified for demonstration purposes.

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for more details.
