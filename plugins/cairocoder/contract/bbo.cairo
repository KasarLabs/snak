// Recursive implementation
fn fibonacci_recursive(n: felt252) -> felt252 {
    if n <= 1 {
        n
    } else {
        fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2)
    }
}

// Iterative implementation
fn fibonacci_iterative(n: felt252) -> felt252 {
    if n <= 1 {
        return n;
    }

    let mut a: felt252 = 0;
    let mut b: felt252 = 1;
    let mut i: felt252 = 2;

    loop {
        if i > n {
            break;
        }
        let temp: felt252 = a + b;
        a = b;
        b = temp;
        i += 1;
    };
    b
}

fn main() {
    let n: felt252 = 10;
    let recursive_result: felt252 = fibonacci_recursive(n);
    let iterative_result: felt252 = fibonacci_iterative(n);

    println!("Fibonacci({}) recursive: {}", n, recursive_result);
    println!("Fibonacci({}) iterative: {}", n, iterative_result);
}