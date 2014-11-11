var ReusableBuffer = function () {
  this.start = 0;
  this.end = 0;
  this.buffer = new Buffer(1024);
};

ReusableBuffer.prototype.size = function() {
  return this.end - this.start;
};

ReusableBuffer.prototype.append = function(chunk) {
  if (this.end + chunk.length > this.size()) {
    if (this.start > 0) {
      if (this.start < this.end) {
        this.buffer.copy(this.buffer, 0, this.start, this.end);
        this.end -= this.start;
        this.start = 0;
      } else {
        this.start = this.end = 0;
      }
    }
  }
  while (this.end + chunk.length > this.buffer.length) {
    this.buffer.length = this.buffer.length + 1024;
  }
  chunk.copy(this.buffer, this.end);
  this.end += chunk.length;
};

ReusableBuffer.prototype.shift = function(offset) {
  this.start += offset;
  if (this.start > this.end) {
    this.start = this.end;
  }
};

ReusableBuffer.prototype.cut = function(offset) {
  var buffer = this.slice(0, offset);
  this.shift(offset);
  return buffer;
};

ReusableBuffer.prototype.toString = function (from, to) {
  from = from || 0;
  to = to || this.size();
  return this.buffer.asciiSlice(this.start + from, this.start + to);
};

ReusableBuffer.prototype.slice = function (from, to) {
  from = from || 0;
  to = to || this.size();
  return this.buffer.slice(this.start + from, this.start + to);
};

ReusableBuffer.prototype.byteAt = function (offset) {
  if (offset < 0 || offset >= this.size())
    throw new RangeError('offset is out of bounds');
  var b = this.buffer[this.start + offset];
  return b;
};

module.exports.ReusableBuffer = ReusableBuffer;
