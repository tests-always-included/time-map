/**
 * Tests confirming TimeMap operates as expected
 */
/*global beforeEach, describe, expect, it, jasmine, runs, spyOn, waitsFor*/

'use strict';

var TimeMap;
TimeMap = require('..');

describe('TimeMap', function () {
    describe('constructor', function () {
        it('does not need arguments', function () {
            var fp;

            fp = new TimeMap();
            expect(fp instanceof TimeMap).toBe(true);
        });
    });
    describe('prototype', function () {
        var fp;

        beforeEach(function () {
            fp = new TimeMap();
        });
        describe('.functionName()', function () {
            it('returns empty string with non-functions', function () {
                expect(fp.functionName()).toEqual('');
                expect(fp.functionName(null)).toEqual('');
                expect(fp.functionName({})).toEqual('');
                expect(fp.functionName(true)).toEqual('');
                expect(fp.functionName(1)).toEqual('');
                expect(fp.functionName('asdf')).toEqual('');
                expect(fp.functionName([])).toEqual('');
            });
            it('finds the name for functions', function () {
                expect(fp.functionName(function testing() {
                    return undefined;
                })).toEqual('testing');
            });
            it('returns an empty string if a name can not be found', function () {
                expect(fp.functionName(function () {
                    return undefined;
                })).toEqual('');
            });
            it('uses the .name property if found', function () {
                // Special case for newer implementations
                var x;

                x = function XYZ() {
                    return undefined;
                };
                x.name = 'testFunc';

                // Some JS engines don't let you set this
                if (x.name === 'testFunc') {
                    expect(fp.functionName(x)).toEqual('testFunc');
                }
            });
            it('parses .toString() if name property is missing', function () {
                // Special case for older implementations
                var x;

                x = 'this makes jslint happy';
                /*jslint evil:true*/
                eval("x = /* comment */ function // single-line comment\n /* multi-line\n * comment */\n\t aFunction \r\n // single \n /* multi \n line */ \n \t (\n\t) {}");
                /*jslint evil:false*/
                x.name = '';

                // Some JS engines don't let you set this property
                if (!x.name) {
                    expect(fp.functionName(x)).toEqual('aFunction');
                }
            });
        });
        describe('.getDate()', function () {
            it('returns a number', function () {
                expect(typeof fp.getDate()).toBe('number');
            });
            it('somewhat times things', function () {
                var start, end;

                runs(function () {
                    start = fp.getDate();
                    end = null;
                    setTimeout(function () {
                        end = fp.getDate();
                    }, 50);
                });
                waitsFor(function () {
                    return end !== null;
                });
                runs(function () {
                    // Timing can get numbers smaller than 50, weirdly
                    // I've seen 49.96086
                    expect(end - start).not.toBeLessThan(45);
                    expect(end - start).toBeLessThan(100);
                });
            });
        });
        describe('with test functions', function () {
            var functions;

            beforeEach(function () {
                functions = {
                    profiled: function () {
                        return undefined;
                    },
                    anotherProfiled: function () {
                        return undefined;
                    },
                    notProfiled: function () {
                        return undefined;
                    }
                };
                fp.profile(functions, 'profiled');
                fp.profile(functions, 'anotherProfiled');
            });
            describe('.findByName()', function () {
                it('returns an array of matches', function () {
                    expect(fp.findByName('profiled')).toEqual([
                        fp.profiles[0]
                    ]);
                });
                it('returns an array when nothing matches', function () {
                    expect(fp.findByName('notProfiled')).toEqual([]);
                });
            });
            describe('.isProfiled()', function () {
                it('returns truthy if the function is profiled', function () {
                    expect(fp.isProfiled(functions.profiled)).toBe(fp.profiles[0]);
                });
                it('returns truthy if the function is profiled and it is not the first', function () {
                    expect(fp.isProfiled(functions.anotherProfiled)).toBe(fp.profiles[1]);
                });
                it('returns false if the function is profiled', function () {
                    expect(fp.isProfiled(functions.notProfiled)).toBe(false);
                });
            });
            describe('with fake logged data and null reporter', function () {
                beforeEach(function () {
                    // Just override a few values - not setting all of the data
                    fp.profiles[0].calls = 3;
                    fp.profiles[0].elapsed = 3;
                    fp.profiles[0].average = 1;
                    fp.profiles[1].calls = 2;
                    fp.profiles[1].elapsed = 20;
                    fp.profiles[1].average = 10;
                    fp.logReporter = function () {
                        return undefined;
                    };
                });
                it('reports all with no filters', function () {
                    expect(fp.log()).toEqual([
                        fp.profiles[0],
                        fp.profiles[1]
                    ]);
                });
                it('filters by minAverage', function () {
                    expect(fp.log({
                        minAverage: 5
                    })).toEqual([
                        fp.profiles[1]
                    ]);
                });
                it('filters by minCalls', function () {
                    expect(fp.log({
                        minCalls: 3
                    })).toEqual([
                        fp.profiles[0]
                    ]);
                });
                it('filters by minElapsed', function () {
                    expect(fp.log({
                        minElapsed: 10
                    })).toEqual([
                        fp.profiles[1]
                    ]);
                });
                it('accepts a custom sorter', function () {
                    var sorterCalled, result;

                    function sorter(a, b) {
                        sorterCalled = true;
                        return a.calls - b.calls;
                    }

                    sorterCalled = false;
                    spyOn(fp, 'logReporter');
                    result = fp.log({
                        sorter: sorter
                    });
                    expect(result).toEqual([
                        fp.profiles[1],
                        fp.profiles[0]
                    ]);
                    expect(sorterCalled).toBe(true);
                    expect(fp.logReporter).toHaveBeenCalledWith(result);
                });
                it('accepts a custom reporter', function () {
                    var reporterCalled;

                    function reporter() {
                        reporterCalled = true;
                    }

                    reporterCalled = false;
                    spyOn(fp, 'logReporter');
                    expect(fp.log({
                        reporter: reporter
                    })).toEqual([
                        fp.profiles[0],
                        fp.profiles[1]
                    ]);
                    expect(reporterCalled).toBe(true);
                    expect(fp.logReporter).not.toHaveBeenCalled();
                });
            });
        });
    });
});
