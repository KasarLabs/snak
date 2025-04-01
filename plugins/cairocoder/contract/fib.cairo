fn fibonacci(n: u32) -> felt252 {
    if n == 0 {
        return 0;
    } else if n == 1 {
        return 1;
    } else {
        let mut a: felt252 = 0;
        let mut b: felt252 = 1;
        let mut i: u32 = 2;
        loop {
            if i > n {
                break;
            }
            let temp: felt252 = a + b;
            a = b;
            b = temp;
            i += 1;
        }
        return b;
    }
}

fn main() -> felt252 {
    fibonacci(10)
}

#[cfg(test)]
mod tests {
    use super::fibonacci;

    #[test]
    fn test_fibonacci() {
        assert(fibonacci(0) == 0, 'Fibonacci(0) should be 0');
        assert(fibonacci(1) == 1, 'Fibonacci(1) should be 1');
        assert(fibonacci(2) == 1, 'Fibonacci(2) should be 1');
        assert(fibonacci(3) == 2, 'Fibonacci(3) should be 2');
        assert(fibonacci(10) == 55, 'Fibonacci(10) should be 55');
    }
}