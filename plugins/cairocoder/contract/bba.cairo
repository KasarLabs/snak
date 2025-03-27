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
        let c = a + b;
        a = b;
        b = c;
        i += 1;
    }
    return b;
}

fn main() {
    for i in 0..3_u8 {
        let fib_number = fibonacci(i as u32);
        println!("Fibonacci number {} is: {}", i, fib_number);
    };
}