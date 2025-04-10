fn main() -> felt252 {
    let n_iterations: felt252 = 5;
    let mut a: felt252 = 0;
    let mut b: felt252 = 1;
    let mut i: felt252 = 0;

    loop {
        if i == n_iterations {
            break;
        }

        let temp: felt252 = a + b;
        a = b;
        b = temp;
        i += 1;
    };

    a
}