function foo(x) {
    for(var i = 0; i < x; i++) {
        x = x * 2;
        yield x;
    }
}

var gen = foo(10)
while (var n = gen.next()) {
  console.log(n);
}

