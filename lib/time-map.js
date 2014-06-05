/**
 * TimeMap - Profile functions and see call counts
 *
 * https://github.com/tests-always-included/time-map
 */
/*global console*/
// fid-umd {"global":1,"jslint":1,"name":"TimeMap"}
/*global define, YUI*/
(function (n, r, s) {
    "use strict";
    var f = function () { return s.call(r); };
    try { module.exports = f(); return; } catch (ignore) {}
    try { exports[n] = f(); return; } catch (ignore) {}
    try { return define.amd && define(n, [], f); } catch (ignore) {}
    try { return YUI.add(n, function (Y) { Y[n] = f(); }); } catch (ignore) {}
    try { r[n] = f(); return; } catch (ignore) {}
    throw new Error("Unable to export " + n);
}("TimeMap", this, function () {
    "use strict";
    // fid-umd end

    var globalObject;

    globalObject = this;

    /**
     * Constructor
     */
    function TimeMap() {
        if (!(this instanceof TimeMap)) {
            return new TimeMap();
        }

        this.profiles = [];
        this.profileExclusions = [];
    }


    /**
     * Find a profile by its name.  Returns an array of all matching profiles.
     *
     * @param {string} name Profile name to match
     * @return {Array}
     */
    TimeMap.prototype.findByName = function (name) {
        var i, result;

        result = [];
        for (i = 0; i < this.profiles.length; i += 1) {
            if (this.profiles[i].name === name) {
                result.push(this.profiles[i]);
            }
        }
        return result;
    };


    /**
     * Determine the name of a function.  Returns the name (string) or ''
     * if none was found.
     *
     * @param {Function} fn Function object
     * @return {string}
     */
    TimeMap.prototype.functionName = function (fn) {
        var result;

        if (typeof fn !== 'function') {
            return '';
        }

        if (fn.name) {
            return fn.name;
        }

        // Handle embedded comments, newlines, etc
        // See http://stackoverflow.com/questions/517411/extracting-nested-function-names-from-a-javascript-function/546984#546984
        /*jslint regexp:true*/
        result = /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/.exec(fn.toString());
        /*jslint regexp:false*/

        if (result) {
            return result[1];
        }

        return '';
    };


    /**
     * Gets the current date in milliseconds.  Might return any number for
     * the first call, but (secondCall - firstCall) must result in the actual
     * elapsed time.
     *
     * Use as high of a resolution timer as is available.
     *
     * @return number
     */
    TimeMap.prototype.getDate = (function () {
        var referenceTime;

        try {
            globalObject.performance.now();
            return function () {
                return globalObject.performance.now();
            };
        } catch (ignore) {}

        try {
            globalObject.performance.webkitNow();
            return function () {
                return globalObject.performance.webkitNow();
            };
        } catch (ignore) {}

        try {
            if (process.hrtime().length === 2) {
                // Set a reference time so we don't possibly go over
                // JavaScript's precision limit
                referenceTime = process.hrtime()[0];
                return function () {
                    var t;
                    t = process.hrtime();
                    return (t[0] - referenceTime) * 1000 + t[1] / 1000000;
                };
            }
        } catch (ignore) {}

        return function () {
            return (new Date()).getTime();
        };
    }());


    /**
     * Determine if the function was profiled already.  If so, return that
     * profile.  If not, return false.
     *
     * @param {Function} fn Unwrapped function
     * @return {TimeMap~profile|false}
     */
    TimeMap.prototype.isProfiled = function (fn) {
        var i;

        for (i = 0; i < this.profiles.length; i += 1) {
            if (this.profiles[i].fn === fn) {
                return this.profiles[i];
            }
        }

        return false;
    };


    /**
     * Log the list of profiles that match settings
     *
     * @param {Object|Function} override Overridden settings or sorting function
     * @return {Array.<TimeMap~profile>} Profiles that matched
     */
    TimeMap.prototype.log = function (override) {
        var i, list, settings, tempList;

        settings = {
            minAverage: 0,
            minCalls: 0,
            minElapsed: 0,
            minSelf: 0,
            minSelfAverage: 0,
            reporter: this.logReporter,
            sorter: null
        };

        if (typeof override === 'function') {
            settings.sorter = override;
        } else if (typeof override === 'object') {
            for (i in override) {
                if (override.hasOwnProperty(i)) {
                    settings[i] = override[i];
                }
            }
        }

        list = this.profiles.slice(0);

        // Filter the list
        if (settings.minAverage || settings.minCalls || settings.minElapsed || settings.minSelf || settings.minSelfAverage) {
            tempList = [];
            for (i = 0; i < list.length; i += 1) {
                if (list[i].average >= settings.minAverage &&
                        list[i].calls >= settings.minCalls &&
                        list[i].elapsed >= settings.minElapsed &&
                        list[i].self >= settings.minSelf &&
                        list[i].selfAverage >= settings.minSelfAverage) {
                    tempList.push(list[i]);
                }
            }
            list = tempList;
        }


        // Sort
        if (settings.sorter) {
            list = list.sort(settings.sorter);
        }

        if (settings.reporter) {
            settings.reporter(list);
        }

        return list;
    };


    /**
     * Report on a list of filtered profile objects
     *
     * @param {Array.<TimeMap~profile>} list Profiles to report
     */
    TimeMap.prototype.logReporter = function (list) {
        var i, item, line;

        function rounded(what) {
            return (Math.round(what * 100) / 100).toFixed(2);
        }

        for (i = 0; i < list.length; i += 1) {
            item = list[i];
            line = '[' + item.index + '] ' + item.name;
            line += ', ' + item.calls;
            line += ', ' + rounded(item.elapsed) + ' (' + rounded(item.average) + ')';
            line += ', ' + rounded(item.self) + ' (' + rounded(item.selfAverage) + ')';
            console.log(line);
        }
    };


    /**
     * @typedef TimeMap~profile
     * @property {number} average Elapsed time divided by the call count
     * @property {number} calls Number of calls to this profile
     * @property {number} elapsed Total elapsed time for this profile
     * @property {Function} fn Wrapped function
     * @property {number} index Index number for this profile in this profiler
     * @property {string} name Name of the profile
     * @property {Function} original Original function
     */


    /**
     * Creates a profile
     *
     * @param {string} name Name for the profile
     * @param {Function} fn Wrapped version
     * @param {Function} original Original function
     * @return {TimeMap~profile}
     */
    TimeMap.prototype.makeProfile = function (name, fn, original) {
        var profile;

        profile = {
            average: 0,
            calls: 0,
            elapsed: 0,
            fn: fn,
            index: this.profiles.length,
            name: name,
            original: original,
            self: 0,
            selfAverage: 0
        };
        this.profiles.push(profile);

        return profile;
    };


    /**
     * Profile a function and its prototype or an object
     *
     * @param {Object} owner Object containing the thing to profile
     * @param {string} name Property name of the thing to profile
     * @param {string} prefix Prefix, for logging
     */
    TimeMap.prototype.profile = function (owner, name, prefix) {
        var target;

        target = owner[name];

        if (typeof target === 'function') {
            if (!prefix) {
                prefix = '';
            }

            this.profileFunction(owner, name, prefix);
            this.profileObject(target.prototype, name + '.prototype');
        } else if (typeof target === 'object' && target) {
            if (!prefix) {
                prefix = name;
            }

            this.profileObject(target, name, prefix);
        }
    };


    /**
     * Profile a function
     *
     * @param {Object} owner Object containing the thing to profile
     * @param {string} name Property name of the thing to profile
     * @param {string} prefix Prefix, for logging
     */
    TimeMap.prototype.profileFunction = function (target, name, prefix) {
        if (typeof target[name] !== 'function') {
            return;
        }

        if (prefix) {
            prefix += '.';
        }

        target[name] = this.wrapFunction(target[name], prefix + name);
    };


    /**
     * Profile all properties on an object
     *
     * @param {Object} target Object for scanning
     * @param {string} prefix Prefix for all properties, for logging
     */
    TimeMap.prototype.profileObject = function (target, prefix) {
        var property;

        for (property in target) {
            if (target.hasOwnProperty(property) && target[property]) {
                this.profileFunction(target, property, prefix);
            }
        }
    };


    /**
     * Clears out the average, calls and elapsed time from all profiles
     */
    TimeMap.prototype.reset = function () {
        var i;

        for (i = 0; i < this.profiles.length; i += 1) {
            this.profiles[i].average = 0;
            this.profiles[i].calls = 0;
            this.profiles[i].elapsed = 0;
            this.profiles[i].self = 0;
            this.profiles[i].selfAverage = 0;
        }
    };


    /**
     * Sorts two profiles by their average time, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortByAverage = function (a, b) {
        return a.average - b.average;
    };


    /**
     * Sorts two profiles by their call count, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortByCalls = function (a, b) {
        return a.calls - b.calls;
    };


    /**
     * Sorts two profiles by their elapsed time, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortByElapsed = function (a, b) {
        return a.elapsed - b.elapsed;
    };


    /**
     * Sorts two profiles by their index position, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortByIndex = function (a, b) {
        return a.index - b.index;
    };


    /**
     * Sorts two profiles by their average self time, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortBySelfAverage = function (a, b) {
        return a.selfAverage - b.selfAverage;
    };


    /**
     * Sorts two profiles by their self time, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortBySelf = function (a, b) {
        return a.self - b.self;
    };


    /**
     * Sorts two profiles by their name, alphabetical, case sensitive, ascending
     *
     * @return number
     */
    TimeMap.prototype.sortByName = function (a, b) {
        if (a.name > b.name) {
            return 1;
        }

        if (a.name < b.name) {
            return -1;
        }

        return 0;
    };


    /**
     * This is how the elapsed time is reported back from timeFunctionCall
     *
     * @callback TimeMap~elapsedCallback
     * @param {number} elapsed How many ms have elapsed
     */


    /**
     * Record the amount of time it takes to run a function and provide
     * that number to a callback.  Then return or throw the appropriate
     * value
     *
     * @param {Function} fn Function to time
     * @param {Object} scope Scope for the function's execution
     * @param {Array.<*>} args Arguments when calling the function
     * @param {TimeMap~elapsedCallback} callback How to report elapsed time
     * @return {*} Original function's return value
     * @throw {*} Original exception thrown, if any
     */
    TimeMap.prototype.timeFunctionCall = function (fn, scope, args, callback) {
        var end, returnVal, start;

        callback = callback || function (elapsed) {
            console.log(elapsed);
        };
        scope = scope || null;
        args = args || [];
        start = this.getDate();

        try {
            returnVal = fn.apply(scope, args);
            end = this.getDate();
            callback(end - start);
            return returnVal;
        } catch (ex) {
            end = this.getDate();
            callback(end - start);
            throw ex;
        }
    };


    /**
     * Wrap a function so it will get profiled.  Creates a new profile using
     * the specified name.
     *
     * @param {Function} original Function to wrap/profile
     * @param {string} name Profile name
     * @return {Function} Wrapped version of the function
     */
    TimeMap.prototype.wrapFunction = function (original, name) {
        var profile, self, wrapped;

        self = this;
        profile = self.isProfiled(original);

        if (profile) {
            return profile.fn;
        }

        wrapped = function () {
            var args, instance, isConstructor, proto;

            function addElapsed(elapsed) {
                var myExclusions;
                myExclusions = self.profileExclusions.pop();
                profile.calls += 1;
                profile.elapsed += elapsed;
                profile.average = profile.elapsed / profile.calls;
                profile.self += elapsed - myExclusions;
                profile.selfAverage = profile.self / profile.calls;
                self.profileExclusions.push(self.profileExclusions.pop() + elapsed);
            }

            function FakeType() {
                return undefined;
            }

            // Test if this is invoked as a constructor
            try {
                isConstructor = this instanceof wrapped;
            } catch (e) {
                isConstructor = false;  // happens if wrapped.__proto__ is a function
            }

            args = Array.prototype.slice.call(arguments);
            self.profileExclusions.push(0);

            if (!isConstructor) {
                // Simple function call
                return self.timeFunctionCall(original, this, args, addElapsed);
            }

            // Invoked as a constructor
            if (Object.create) {
                proto = Object.create(original.prototype);
            } else {
                FakeType.prototype = original.prototype;
                proto = new FakeType();
                /*jslint sub:true*/
                proto['__proto__'] = original.prototype;
                /*jslint sub:false*/
            }

            instance = self.timeFunctionCall(original, proto, args, addElapsed);

            if (typeof instance === 'object' && instance) {
                return instance;
            }

            return proto;
        };

        profile = self.makeProfile(name, wrapped, original);
        wrapped.prototype = original.prototype;
        wrapped.constructor = original.constructor;
        return wrapped;
    };


    /**
     * Wraps a function once.  If the function is already profiled, this
     * returns the original profile's wrapped function.  Otherwise
     * wrapFunction() is called and its new wrapped function is returned.
     *
     * @param {Function} original Function to wrap/profile
     * @param {string} name Profile name
     * @return {Function} Wrapped version of the function
     */
    TimeMap.prototype.wrapFunctionOnce = function (original, name) {
        var i;

        for (i = 0; i < this.profiles.length; i += 1) {
            if (this.profiles[i].original === original) {
                return this.profiles[i].fn;
            }
        }

        return this.wrapFunction(original, name);
    };


    return TimeMap;


    // fid-umd post
}));
// fid-umd post-end
