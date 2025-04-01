fn main() {
    let n = 10; // Desired Fibonacci number
    let result = fibonacci(n);
    // Print or use the result as needed
    // core::debug::print(result); // Example: printing the result
}

fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    }

    let mut a = 0;
    let mut b = 1;
    let mut i = 2;

    loop {
        if i > n {
            break;
        }
        let temp = a + b;
        a = b;
        b = temp;
        i = i + 1;
    };
    b
}