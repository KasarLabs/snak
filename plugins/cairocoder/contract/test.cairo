fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    } else {
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}

fn main() {
    let n = 10; // Change this value to calculate the Fibonacci sequence up to a different number
    let mut i = 0;
    loop {
        if i > n {
            break;
        }
        println!("Fibonacci({}) = {}", i, fibonacci(i));
        i += 1;
    };
}