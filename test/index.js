/**
 * Copyright (c) 2014 Tim Kuijsten
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict';

/*jshint -W068 */

var should = require('should');

var LDJSONStream = require('../index.js');

describe('LDJSONStream', function() {
  it('should require opts to be an object', function() {
    (function() { var ls = new LDJSONStream(''); return ls; }).should.throw('opts must be an object');
  });

  it('should require opts.maxDocLength to be a number', function() {
    (function() { var ls = new LDJSONStream({ maxDocLength: '' }); return ls; }).should.throw('opts.maxDocLength must be a number');
  });

  it('should require opts.maxBytes to be a number', function() {
    (function() { var ls = new LDJSONStream({ maxBytes: '' }); return ls; }).should.throw('opts.maxBytes must be a number');
  });

  it('should require opts.debug to be a boolean', function() {
    (function() { var ls = new LDJSONStream({ debug: '' }); return ls; }).should.throw('opts.debug must be a boolean');
  });

  it('should require opts.hide to be a boolean', function() {
    (function() { var ls = new LDJSONStream({ hide: '' }); return ls; }).should.throw('opts.hide must be a boolean');
  });

  it('should construct', function() {
    var ls = new LDJSONStream();
    return ls;
  });

  it('should be a writable stream', function(done) {
    var ls = new LDJSONStream();
    ls.end(done);
  });

  it('should be a readable stream', function(done) {
    var ls = new LDJSONStream();
    ls.resume();
    ls.on('end', done);
    ls.end();
  });

  it('should emit one valid empty object', function(done) {
    var ls = new LDJSONStream();
    ls.on('data', function(obj) {
      should.deepEqual(obj, {});
      done();
    });
    ls.end('{}\n');
  });

  it('should err when more than maxBytes are written', function(done) {
    var ls = new LDJSONStream({ maxBytes: 2 });
    ls.on('error', function(err) {
      should.strictEqual(err.message, 'more than maxBytes received');
      done();
    });
    ls.on('data', function() { throw Error('incomplete object emitted'); });
    ls.end('{}\n');
  });

  it('should err when maxDocLength is exceeded', function(done) {
    var ls = new LDJSONStream({ maxDocLength: 1 });
    ls.on('data', function() { throw Error('incomplete object emitted'); });
    ls.on('error', function(err) {
      should.strictEqual(err.message, 'document exceeds configured maximum length');
      done();
    });
    ls.end('{}\n');
  });

  it('should err if max bytes is received, including newlines', function(done) {
    var ls = new LDJSONStream({ maxDocLength: 2, maxBytes: 3 });
    ls.on('data', function() { throw Error('incomplete object emitted'); });
    ls.on('error', function(err) {
      should.strictEqual(err.message, 'more than maxBytes received');
      done();
    });
    ls.end('{}\r\n');
  });

  it('should err if JSON is invalid', function(done) {
    var ls = new LDJSONStream();
    ls.on('error', function(err) {
      should.strictEqual(err.message, 'Unexpected token f');
      done();
    });
    ls.end('{ \r\n foo: "bar" }\n');
  });

  it('should err when only a newline is written', function(done) {
    var ls = new LDJSONStream();
    ls.on('data', function() { throw Error('incomplete object emitted'); });
    ls.on('error', function(err) {
      should.strictEqual(err.message, 'Unexpected end of input');
      done();
    });
    ls.on('close', done);
    ls.end('\r\n');
  });

  it('should support multi-line json', function(done) {
    var ls = new LDJSONStream();
    ls.on('data', function(obj) {
      should.deepEqual(obj, {
        foo: 'bar'
      });
      done();
    });
    ls.end('{ \r\n "foo": \n "bar" }\n');
  });

  it('should deserialize a generated JSON string correctly', function(done) {
    var obj = {
      foo: 'bar',
      bar: 42,
      baz: false,
      qux: null
    };

    var ls = new LDJSONStream();
    ls.on('data', function(data) {
      should.deepEqual(data, {
        foo: 'bar',
        bar: 42,
        baz: false,
        qux: null
      });
      done();
    });
    ls.end(JSON.stringify(obj));
  });

  it('should deserialize two generated JSON strings correctly', function(done) {
    var obj1 = {
      foo: 'bar'
    };

    var obj2 = {
      foo: 'baz',
      bar: 42,
      baz: false,
      qux: null
    };

    var ls = new LDJSONStream();

    var arr = [];

    ls.on('data', function(data) {
      arr.push(data);
    });

    ls.on('end', function() {
      should.strictEqual(arr.length, 2);
      should.deepEqual(arr[0], {
        foo: 'bar'
      });
      should.deepEqual(arr[1], {
        foo: 'baz',
        bar: 42,
        baz: false,
        qux: null
      });
      done();
    });

    ls.end(JSON.stringify(obj1) + '\r\n' + JSON.stringify(obj2));
  });

  it('should skip noise in previous chunks and emit two generated JSON objects', function(done) {
    var noise = '289,df';

    var obj1 = {
      foo: 'bar'
    };

    var obj2 = {
      foo: 'baz',
      bar: 42,
      baz: false,
      qux: null
    };

    var ls = new LDJSONStream({ debug: false });

    var arr = [];

    ls.on('error', function(err) {
      should.strictEqual(err.message, 'Unexpected token ,');
    });

    ls.on('data', function(data) {
      arr.push(data);
    });

    ls.on('end', function() {
      should.strictEqual(arr.length, 2);
      should.deepEqual(arr[0], {
        foo: 'bar'
      });
      should.deepEqual(arr[1], {
        foo: 'baz',
        bar: 42,
        baz: false,
        qux: null
      });
      done();
    });

    ls.write(noise + '\n');
    ls.write(JSON.stringify(obj1) + '\n' + noise + '\n' + JSON.stringify(obj2));
    ls.write('\n' + JSON.stringify(obj2));
    ls.end();
  });
});
