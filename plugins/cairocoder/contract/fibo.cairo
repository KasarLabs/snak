fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}

fn main() -> u32 {
    let n = 10; // Calculate the nth Fibonacci number
    let result = fibonacci(n);
    return result;
}