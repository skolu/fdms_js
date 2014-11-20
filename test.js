var a = function (num) {
  this.a = num;
};
a.prototype.dump_a = function() {
  console.log("a" + this.a);
};

var b = function (num) {
  this.b = num;
};
b.prototype = new a(0);
b.prototype.dump = function() {
  console.log("b" + this.b);
  this.dump_a();
};

var c = new b(3);
c.a = 2;

c.dump();
