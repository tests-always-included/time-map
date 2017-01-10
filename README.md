TimeMap - JavaScript Profiling
=================================

Profile the time it takes to run your functions.

[![npm version][npm-badge]][npm-link]
[![Build Status][travis-badge]][travis-link]
[![Dependencies][dependencies-badge]][dependencies-link]
[![Dev Dependencies][devdependencies-badge]][devdependencies-link]

There are better tools, such as Chrome's built-in profiler and debugging through node.js.  When those advanced things are not at your disposal, you must rely on something.  For instance, there could be some code in your application that is causing drastic performance problems in Internet Explorer 8.  What can you do?  Manual profiling.


Getting Started
---------------

First you need to have the `TimeMap` object available.  You need to load `lib/time-map.js` and you can do that in several ways:


### Web Browser

Just put the JavaScript file into somewhere that you can serve and include a script tag.  Next you will need to make a profiler object.  To make things simpler, I've created `add-to-browser.js` that does this for you, but you are welcome to do that yourself.

```html
<script src="...your...path.../time-map.js"></script>
<script src="...your...path.../add-to-browser.js"></script>
```

Lastly, start profiling functions, objects, and more.

```javascript
window.timeMap.profile(myObject);
window.timeMap.log();
```


### Web Browser with Module Loader

TimeMap uses [FidUmd] to make a universal module format.  You should be able to load it dynamically with your preferred system and have it available.


### node.js module

First, in your `package.json` file, add a dependency or devDependency on "time-map".  Next, use this code to create an instance and start profiling.

```javascript
var TimeMap = require('time-map');
var timeMap = new TimeMap();  // Makes an instance
timeMap.profile(myObject);
timeMap.log();
```


### Other systems

TimeMap uses [FidUmd] so the library should be loadable in your preferred JavaScript environment in whatever way you normally load code.


Typical Usage
-------------

For this example, I will assume that the `timeMap` variable contains an instance of TimeMap.

```javascript
// Profile just a function as "someFunction"
var fn = function () {};
fn = timeMap.wrapFunction(fn, 'someFunction');

// Profile every function on an object as "MyObject"
var obj = {
    a: function () {}
};
timeMap.profileObject(obj, "MyObject");

// Profile every function actually on an instance.
// Does not profile functions on its prototype!
var coordSystem = new CoordinateSystem()
timeMap.profile(coordSystem)

// Profile a constructor, node.js
// This will also get functions on its prototype
var libraries = {
    MyLibrary = require('MyLibrary')
};
timeMap.profile(libraries, 'MyLibrary');
var lib = new libraries.MyLibrary();
// The constructor was profiled and all methods will be as well.

// Report everything to console
timeMap.log();

// Report long stuff to console sorted by number of calls
timeMap.log({
    minElapsed: 1000,  // 1 second
    sorter: timeMap.sortByCalls
});
```


How it Works
------------

Functions are wrapped with an anonymous function that will start a timer and pass on arguments to the real function.  The real one will finish and the returned value or thrown exception is remembered.  The timer is stopped and a little housekeeping is performed in order to keep the logs up to date, then the wrapper will return or throw the exception.  It's all transparent.

This also detects if you are creating an object instance automatically and returns the appropriate thing in those cases.

When profiling a function, it will be replaced with a wrapped function.  If it has a prototype, all functions on that prototype will be profiled as well.  Those prototype functions will be replaced by the wrapped version.  The profiling does not continue up the prototype chain.

When profiling an object, each property that is a function will be profiled and the wrapped function will replace the original property.

Timing is done with a high resolution timer (`performance.now()` for Chrome, `process.hrtime()` for node.js) or by constructing `Date` objects.  Please be aware that Internet Explorer's `Date` object's time resolution is limited and can't get down to the millisecond ([more information](http://www.merlyn.demon.co.uk/js-dates.htm#OV)).


API Documentation
-----------------


### new TimeMap()

Returns a TimeMap instance.  There's no configuration.


### TimeMap.prototype.isProfiled(fn)

Returns false if the function passed in has not been profiled.  If it is in the list of profiled functions, the profile object is returned.  The profile object is detailed under `makeProfile`.


### TimeMap.prototype.findByName(name)

Returns an array of all profiles with the associated name.  Can be an empty array.  Profile objects are detailed under `makeProfile`.  This is a convenience function for you as it isn't used by this library, but it is fitting and could easily be adopted into your own reporters.


### TimeMap.prototype.functionName(fn)

Returns the name of a given function.  If the `name` property is not set, the function will be cast to a string and tested against a pattern to see if there was a name given when it was created.  If no name is available, this returns an empty string.


### TimeMap.prototype.getDate()

Returns a timestamp used for timing functions.  This should be a very fast function and as accurate as possible.  It returns times in milliseconds.  Times do not need to be from any given starting point, which means that it might return 0 for the first invocation, but will always return the elapsed time when used like `endTime - startTime`.


### TimeMap.prototype.log(override)

Logs all profiled information.  When passing a function for `override`, it will use that function for reporting.  Otherwise, `override` can be an object that will be used to change any of these default settings:

```javascript
defaultSettings = {
    // Profile filters
    minAverage: 0,
    minCalls: 0,
    minElapsed: 0,

    // Reporting
    reporter: this.logReporter,
    sorter: null
}
```

The filters determine what profiles get reported.  You might profile everything in your app but may only be interested in things that get called over 250,000 times.  Average is the total elapsed time divided by the number of times it was called.

The `reporter` setting defaults to `logReporter`, and is the way the profiles are reported back to you.  You can override the function so that results are not sent to the console or so they are presented differently.  The `sorter` setting can be a function that will accept two profile objects and will sort them to be in the order most beneficial to you.  There's a couple included in `TimeMap`.


### TimeMap.prototype.logReporter(profileList)

`profileList` is an array of profile objects.  Profile objects are detailed under `makeProfile`.  This function is responsible for displaying the list of profiles somehow.  The default one will just `console.log()` the list in a somewhat readable form.


### TimeMap.prototype.makeProfile(name, fn, original)

Creates a new profile object with the right properties initialized.  Properties are listed here:

```javascript
profileObject = {
    average: number,  // Merely calls/elapsed
    calls: number,  // How many times the wrapper was called
    elapsed: number,  // Total elapsed time
    fn: Function,  // Wrapper function
    index: number,  // Index in the timeMap.profiles array
    name: string,  // Name used when setting up the profile
    original: Function  // Original function, unwrapped
}
```


### TimeMap.prototype.profile(owner, name, prefix)

Profile an object or function.  If profiling a function and it has a `prototype` property (ie. a constructor), each function listed there will be profiled as well.  Objects will be scanned and all properties that are functions will be profiled.

`owner` is the object that holds the function you wish to profile.  If you are dealing with global functions, you can often use `window` or `this` in place of owner.  `name` is the name of the property on `owner` that contains the function.  `prefix` is the prefix, if any, to assign to the profiled name.  Here's some examples:

```javascript
window.TestObject = function () {};
window.TestObject.prototype.aaa = function () {};
timeMap(window, 'TestObject');

window.bbbb = function () {};
timeMap(window, 'bbbb', 'sampleThing');
```

This will replace `window.TestObject` with a wrapped version and that will report automatically as "TestObject" as that's the `name` parameter.  It also replaces `window.TestObject.prototype.aaa` with a different wrapped function and profiles it as "TestObject.prototype.aaa".

Likewise, `window.bbbb` is replaced with a wrapped version.  It's different because it will be reported as "sampleThing".  If it had functions on its prototype, they would have been reported as "sampleThing.prototype.functionName".


### TimeMap.prototype.profileFunction(target, name, prefix)

This isn't really intended to be called from outside the library as `profile` would call this for you.  `target`, `name` and `prefix` are all the same as `profile`.


### TimeMap.prototype.profileObject(target, prefix)

Profile every property on an object if it is a function.  `target` is the object in question.  `prefix` is an optional prefix to add for the logging.

```javascript
var myObject = {
    a: function () {},
    bbb: function () {}
};
/// I will profile this as the "ZZZzZZZ" object
timeMap.profileObject(myObject, "ZZZzZZZ");
// Profiles "a" as "ZZZzZZZ.a"
// Profiles "bbb" as "ZZZzZZZ.bbb"
```


### TimeMap.prototype.reset()

Clear out the accumulated counters for all profiles.  This resets the number of calls, elapsed time and average time.


### TimeMap.prototype.sortByAverage(a, b)

Sorts profiles by their average time.  Higher numbers are reported later.


### TimeMap.prototype.sortByCalls(a, b)

Sorts profiles by the number of times they were called.  Higher numbers are reported later.


### TimeMap.prototype.sortByElapsed(a, b)

Sorts profiles by the total amount of elapsed time.  Higher numbers are sorted later.


### TimeMap.prototype.sortByIndex(a, b)

Sorts profiles by their placement in the `profiles` array.


### TimeMap.prototype.sortByName(a, b)

Sorts profiles alphabetically, case sensitive.


### TimeMap.prototype.timeFunctionCall(fn, scope, args, callback) {

Starts a timer, calls the original function, stops the timer, then calls the callback.  `fn` is the original function.  `scope` is what should be used for `this` in the function call.  `args` is an array, which is likely a copy of `arguments` to a wrapped function.  `callback` is a reporting function that is passed only the elapsed time.


### TimeMap.prototype.wrapFunction(original, name) {

Wrap the `original` function in another that will pass on arguments, pass back the returned value, rethrow exceptions and even handle being invoked as a constructor.  This wrapped function will also log to a new profile that is given the name of `name`.

Returns the wrapped function.


### TimeMap.prototype.wrapFunctionOnce(original, name) {

Determines if this function was profiled already.  If so, returns the original profile's wrapped function.

If not already profiled, this calls `wrapFunction` and passes back the results.


Gotchyas
--------

Because the functions are replaced only at the time of profiling, it is possible for them to be overridden or not called.  Consider this code:

```javascript
window.a = function () {};  // First
timeMap(window, 'a');
// window.a is now the profiling-wrapped version
var oldA = window.a;
window.a = function () { oldA(); oldA(); oldA() };
// Overridden

window.a();  // Only one call here
timeMap.log();
// Looks like three calls were made
```


Developing
----------

First, clone the repository.  Then run `npm install` to fetch dependencies.


Testing
-------

Tests are *always* included.  You can run them with the following command.

    npm test


License
-------

TimeMap is released under an [MIT License][LICENSE] with an additional non-advertising clause.  Check the repository for the full text.

[dependencies-badge]: https://img.shields.io/david/tests-always-included/time-map.svg
[dependencies-link]: https://david-dm.org/tests-always-included/time-map
[devdependencies-badge]: https://img.shields.io/david/dev/tests-always-included/time-map.svg
[devdependencies-link]: https://david-dm.org/tests-always-included/time-map#info=devDependencies
[FidUmd]: https://github.com/fidian/fid-umd
[LICENSE]: LICENSE.md
[npm-badge]: https://img.shields.io/npm/v/time-map.svg
[npm-link]: https://npmjs.org/package/time-map
[travis-badge]: https://img.shields.io/travis/tests-always-included/time-map/master.svg
[travis-link]: http://travis-ci.org/tests-always-included/time-map
