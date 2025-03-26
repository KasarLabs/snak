fn main() -> u32 {
    let mut x: u32 = 0; // Define a mutable variable x of type u32 and initialize it to 0 [10].

    loop { // Use a loop to increment the variable [7, 8].
        x = x + 1; // Increment x by 1.

        if x == 10 { // Check if x is equal to 10 [8].
            break; // If x is 10, exit the loop [7].
        }
    }

    x // Return the final value of x [2].
}