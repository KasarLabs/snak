fn fibonacci_number(n: u32) -> u32 {
    if n <= 1 {
        return n;
    }

    let mut n_minus_2 = 0_u32;
    let mut n_minus_1 = 1_u32;
    let mut current = 0_u32;
    let mut i = 2_u32;

    while i <= n {
        current = n_minus_1 + n_minus_2;
        n_minus_2 = n_minus_1;
        n_minus_1 = current;
        i += 1;
    };

    return current;
}