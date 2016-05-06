# Testing RealSense extensions in continuous integration (CI)

## Creating testharness.js based test cases

W3C [testharness.js](https://github.com/w3c/testharness.js) provides a framework
for writing low-level tests of browser functionality in Javascript, which has
been used by [Crosswalk test
suite](https://github.com/crosswalk-project/crosswalk-test-suite) and
[W3C web platform tests](https://github.com/w3c/web-platform-tests). It is
valuable to create testharness.js based test cases for these RealSense APIs
which don't require real 3D camera support, for example, in the continuous
integration system.

It is easy to use the testharness.js in your test file; just include two scripts
in the order given:

```js
<script src="resources/testharness.js"></script>
<script src="resources/testharnessreport.js"></script>
```

A `div` element with ID `log` will be created if there is no
`<div id="log"></div>` in the test file; and the `resources/testharness.css`
will be loaded automatically when show the test results.

To make things simple, you can use the [index.html](./index.html) in this
directory as entry test file of your tests. Just create tests in `your-tests.js`
for example and include the script there:

```js
<script src="your-tests.js"></script>
```

The testharness.js provides a convenient API for making assertions and is
intended to work for both simple synchronous tests and for tests of asynchronous
behavior including Promise tests. See full [user documentation for the
API](https://github.com/w3c/testharness.js/blob/master/docs/api.md). You can
also read a tutorial on [Using
testharness.js](https://darobin.github.io/test-harness-tutorial/docs/using-testharness.html).

## Dumping test results

The [testharnessreport.js](./resources/testharnessreport.js#L385) provides a
function to dump test results for the test file and its sub-tests in JSON format.

```json
{
  "test":"http://localhost:8000/index.html",
  "tests":[
    {
      "name":"Check that window supports realsense",
      "status":0,
      "message":null,
      "stack":null
    },
    {
      "name":"Check that realsense is type of object",
      "status":0,
      "message":null,
      "stack":null
    }
  ],
  "status":0,
  "message":null,
  "stack":null
}
```

The `test` has 3 status values to indicate the testharness's status:

```json
{
  OK:0,
  ERROR:1,
  TIMEOUT:2
}
```

... while `tests` contains 4 status values to indicate each test's status:

```json
{
  PASS:0,
  FAIL:1,
  TIMEOUT:2,
  NOTRUN:3
}
```

If a test is not passed, the `message` will record the error messages. The
`stack` field hasn't been used in this use case; so just ignore it.

Therefore we can post the test data dumped in JSON to the server side via
Ajax `XMLHttpRequest()` and then parse the test data for the CI to indicate
pass or fail.

## Customizing SimpleHTTPServer with POST support

This project once used `python -m SimpleHTTPServer` to start an HTTP server
serving as `http://localhost:8000/index.html`. However this server doesn't
support the POST method. Therefore we implement a new server with POST support
named `rsserver.py`, where `rs` means realsense.

Actually the POST method only accepts and parses the data in the JSON format
as dumped above. If the data isn't in that format, it will send out a 405 error
as `Unsupported media type`; otherwise it sends out a 400 error saying `Bad
request`.

After successfully accepts and parses the posted data, this server sends out
a 200 response with `no-cache` header and then closes itself so that the test
file can close itself too after receives this response and then makes a new
clean running.

You can simply run `rsserver.py` to manually start the server.

## Running the tests

To run the tests, we firstly need to start the server via `rsserver.py`
listening to the 8000 port.

Then we need to start the `xwalk.exe` application with `manifest.json` in this
directory. We leverage the `xwalk.exe` application from Crosswalk Project for
Windows binary that is used for building the samples in this project. Just use
`7z x crosswalk64-%XWALK_VERSION%.zip` which is supported by the CI system.

Finally we create a Python script `test.py` to incorporate all the testing
logics above. Thus you can simply run the tests within `index.html` via

```bat
test.py
```

Please *note* that the Python based scripts may be rewritten in Node JavaScript
so that we can unify the programming languages in both server and client sides.
