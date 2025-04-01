fn fibonacci(n: u32) -> felt252 {
    if n <= 1 {
        return n.into();
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}

fn main() {
    let result = fibonacci(10);
    println!("Fibonacci(10) = {}", result);
}