fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    }

    let mut a = 0;
    let mut b = 1;
    let mut i = 2;

    loop {
        let c = a + b;
        a = b;
        b = c;

        if i > n {
            break;
        }
        i += 1;
    };
    b
}

#[executable]
fn main() -> u32 {
    fibonacci(10)
}