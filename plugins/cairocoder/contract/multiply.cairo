fn multiply(x: u32, y: u32) -> u32 {
    x * y
}

fn main() {
    let product = multiply(6, 7);
    // The return value of main is implicitly `product`
    product;
}