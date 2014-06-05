/**
 * Patch Angular.js to provide really detailed profiling information
 *
 * It is quite difficult to patch Angular.  Ideally we would reach in and
 * directly wrap some functions and be done, but the way the code was written
 * uses good variable/function encapsulation and thus many things are outside
 * of my reach, especially in the startup of the app.
 *
 * I chose to follow Batarang's model by grabbing $provider from Angular
 * and poking deeply into the various structures I can get.  Thanks go out
 * to those developers of Batarang.  I just wish it worked in IE8 and other
 * browsers too.
 *
 * FIXME:  What if this script is loaded before Angular?
 *
 *
 * What is Tracked
 * ===============
 *
 * All expressions and listeners registered with $watch on any scope.
 * All things provided by $provider, which may not be much.  It depends on
 * when add-to-angular.js is loaded.
 * All things provided by $injector for the ng module (which is the same
 * injector for everywhere else).
 * The results of all compile functions.
 * Creating controllers and their watches.
 *
 *
 * Angular.module(name, requires, configFn) returns a module object that has
 * the following methods.  They are all invokeLater() calls.
 *
 * METHOD (INVOKE_LATER_ARGS) = (REAL_ARGS)
 * provider ($provide, provider) = (name, providerType)
 * factory ($provide, factory) = (name, providerFunction)
 * service ($provide, service) = (name, constructor)
 * value ($provide, value) = (name, anything)
 * constant ($provide, constant, unshift) = (name, anything)
 * filter ($filterProvider, register) = (name, filterFactory)
 * controller ($controllerProvider, register) = (name, constructor)
 * directive ($compileProvider, directive) = (name, directiveFactory)
 * config ($injector, invoke) = (configFn)
 * run (all called right away by createInjector as the return from loadModules) = (initializationFn)
 *
 * Constants are applied first and can not be decorated.
 *
 *
 * Batarang patches the following
 *
 * $provide methods:  provider, factory, service
 * $rootScope.__proto__ methods:  $watch, $destroy, $new, $digest, $apply
 * -- The $watch expression and listener are both wrapped
 */
/*global console*/
(function (wind) {
    'use strict';

    function AngularProfiler(angular) {
        this.angular = angular;
        this.profiler = new wind.TimeMap();
        angular.timeMap = this.profiler;
        angular.timeMapProfiler = this;
        this.patchAngular();
        this.watcherHints = [];
        this.logWatchChanges = false;
    }

    AngularProfiler.prototype.addWatcherHinting = function (fn, objectName, methodName) {
        var attrName, myself;

        function addHint(fn, hintName) {
            return myself.delegation(fn, function (args) {
                var attributes, i;

                for (i = 0; i < args.length; i += 1) {
                    if (args[i] && args[i].$$element && args[i].$attr) {
                        attributes = args[i];
                        i = args.length;
                    }
                }

                if (attributes && attributes[attrName]) {
                    myself.watcherHints.push(hintName + ',' + JSON.stringify(attributes[attrName]));
                } else {
                    myself.watcherHints.push(hintName);
                }
            }, function (returned) {
                myself.watcherHints.pop();
                return returned;
            });
        }

        myself = this;
        attrName = objectName.replace(/Directive$/, '');

        if (typeof fn === 'function') {
            // fn(scope, iterStartElement, attr, controller)
            return addHint(fn, objectName + '.' + methodName);
        }

        if (typeof fn === 'object') {
            // { pre: function (...) {} }
            this.angular.forEach(fn, function (value, key) {
                if (typeof value === 'function') {
                    fn[key] = addHint(value, objectName + '.' + methodName + '.' + key);
                }
            });
        }

        // Unsure what this could be.  Sometimes it is undefined.
        return fn;
    };

    AngularProfiler.prototype.decorateRootScope = function ($provide) {
        var myself;

        myself = this;
        // Now do things to the scope directly via a decorator
        $provide.decorator('$rootScope', ['$delegate', function ($delegate) {
            var proto;

            // Only do this once per root scope
            if (!$delegate.timeMap) {
                $delegate.timeMap = true;

                // The root scope has all child scopes registered.  Wrap
                // all watchers already registered somewhere.
                myself.forEachScope($delegate, function (scope) {
                    myself.wrapWatchers(scope);
                });

                // Patch $watch(watchExp, listener, objectEquality)
                proto = myself.getPrototypeOf($delegate);

                // You can't get the prototype correctly in IE, even though
                // we do try moderately hard.
                if (proto.$watch) {
                    // Probably not IE8
                    myself.patchScopeWatch(proto);
                } else {
                    myself.forEachScope($delegate, function (scope) {
                        myself.patchScopeNewForWatch(scope);
                        myself.patchScopeWatch(scope);
                    });
                }
            }
            return $delegate;
        }]);
    };

    AngularProfiler.prototype.delegation = function (originalFn, beforeFn, afterFn) {
        var returned;

        if (typeof originalFn !== 'function') {
            return originalFn;
        }

        returned = function () {
            var args, result;
            args = Array.prototype.slice.apply(arguments);

            if (beforeFn) {
                beforeFn.call(this, args);
            }

            try {
                result = originalFn.apply(this, args);

                if (afterFn) {
                    result = afterFn.call(this, returned, args);
                }

                return result;
            } catch (e) {
                if (afterFn) {
                    afterFn.call(this, undefined, args, e);
                }

                throw e;
            }
        };

        if (originalFn.$inject) {
            returned.$inject = originalFn.$inject;
        }

        return returned;
    };

    AngularProfiler.prototype.forEachScope = function ($scope, fn) {
        var $child;

        if (!$scope) {
            return;
        }

        // Call for this scope
        fn($scope);

        // Call for children
        $child = $scope.$$childHead;

        while ($child) {
            this.forEachScope($child, fn);
            $child = $child.$$nextSibling;
        }
    };

    AngularProfiler.prototype.functionName = function (fn, defaultName) {
        var name;

        name = this.profiler.functionName(fn);

        if (!name) {
            if (defaultName === undefined) {
                return 'anonymous';
            }

            return defaultName;
        }

        return name;
    };

    AngularProfiler.prototype.getPrototypeOf = function (obj) {
        var proto;

        if (Object.getPrototypeOf) {
            return Object.getPrototypeOf(obj);
        }

        proto = '__proto__';

        if (obj[proto]) {
            return obj[proto];
        }

        if (obj.constructor) {
            return obj.constructor.prototype;
        }

        return Object.prototype;
    };

    AngularProfiler.prototype.patchAngular = function () {
        var ngModule, myself;
        // 1)  Get the Angular base module
        // 2)  Run the config method to immediately run some code with injection
        // 3)  Get $provide, which gives us everything else
        // 4)  Patch $provide and everything else already added
        myself = this;
        ngModule = this.angular.module('ng');
        ngModule.config(['$provide', function ($provide) {
            myself.wrapFactory($provide);
            myself.wrapProvider($provide);
            myself.wrapService($provide);
            myself.decorateRootScope($provide);
        }]);

        // How about things already in the injector
        ngModule.run(['$injector', function ($injector) {
            myself.wrapInjector($injector);
        }]);

        // Wrap new module declarations so I can trap run, config, etc.
        // The modules that are already loaded are hidden away.
        this.wrapModule();
    };

    AngularProfiler.prototype.patchScopeNewForWatch = function (scope) {
        var myself;
        myself = this;
        scope.$new = this.delegation(scope.$new, null, function (returned) {
            myself.patchScopeWatch(returned);
            return returned;
        });
    };

    // This can act upon a Scope instance or the Scope object's prototype
    AngularProfiler.prototype.patchScopeWatch = function (scope) {
        var myself;
        myself = this;
        scope.$watch = this.delegation(scope.$watch, function (returned) {
            // Just rewrap anything that's new.  "this" === scope
            myself.wrapWatchers(this);
            return returned;
        });
    };

    // This must wrap only once, but that checking is handled by TimeMap
    AngularProfiler.prototype.profileFunction = function (originalFn, name) {
        var wrapped;
        wrapped = this.profiler.wrapFunctionOnce(originalFn, name);

        if (originalFn.$inject) {
            wrapped.$inject = originalFn.$inject;
        }

        return wrapped;
    };

    AngularProfiler.prototype.profileInjectable = function (injectable, objectName, methodName, functionName) {
        var myself;
        myself = this;
        return this.swapInjectable(injectable, function (fn) {
            var fnName;
            fnName = functionName || myself.functionName(fn);

            // Add hinting for this function
            fn = myself.addWatcherHinting(fn, objectName, methodName);

            // Add hinting for anything returned by the function
            fn = myself.delegation(fn, null, function (result) {
                return myself.addWatcherHinting(result, objectName, methodName);
            });

            return myself.profileFunction(fn, objectName + '.' + methodName + '(' + fnName + ')');
        });
    };

    AngularProfiler.prototype.swapInjectable = function (injectable, callback) {
        var index;

        if (this.angular.isArray(injectable)) {
            // The last element is the function to wrap
            index = injectable.length - 1;

            if (typeof injectable[index] === 'function') {
                injectable[index] = callback(injectable[index]);
            }
        } else if (typeof injectable === 'function') {
            injectable = callback(injectable);
        }

        return injectable;
    };

    AngularProfiler.prototype.wrapFactory = function ($provide) {
        var myself;
        myself = this;
        $provide.factory = this.delegation($provide.factory, function (args) {
            args[1] = myself.profileInjectable(args[1], args[0], 'factory');
        });
    };

    AngularProfiler.prototype.wrapInjector = function ($injector) {
        var myself;

        // Only wrap once
        if ($injector.timeMap) {
            return;
        }

        $injector.timeMap = true;
        myself = this;

        // FIXME:  Could also wrap invoke
        // FIXME:  Could profile instantiate call
        // FIXME:  Consider poking around with annotate to avoid
        // .$inject property propegation in profileFunction
        $injector.instantiate = this.delegation($injector.instantiate, function (args) {
            var fnName;
            fnName = myself.functionName(args[0]);
            myself.watcherHints.push(fnName + '.construct');
        }, function (returned, args) {
            myself.watcherHints.pop();
            returned = myself.profileInjectable(returned, args[0], 'constructor');
            return returned;
        });
        $injector.get = this.delegation($injector.get, null, function (returned, args) {
            if (typeof returned === 'function') {
                // This seems to be filters
                // args[0] ~= /Filters$/
                returned = myself.profileInjectable(returned, args[0], 'get');
            } else if (!returned.timeMap) {
                // Only profile once as a speed booster
                returned.timeMap = true;

                // `returned` is an array with a single object that has
                // properties that could be functions.
                //
                // Skip the following as they are not ever functions:
                // controllerAs, name, priority, replace, require, restrict,
                // scope, templateUrl, terminal, transclude
                //
                // Handle these injectables if they are an injectable:
                ['compile', 'controller', 'link', 'template'].forEach(function (name) {
                    var fn;

                    if (returned[0][name] === undefined) {
                        return;
                    }

                    fn = returned[0][name];
                    fn = myself.profileInjectable(fn, args[0], name);
                    returned[0][name] = fn;
                });
            }

            return returned;
        });
    };

    AngularProfiler.prototype.wrapModule = function () {
        var myself;
        myself = this;
        this.angular.module = this.delegation(this.angular.module, null, function (moduleDef, args) {
            moduleDef.config = myself.profileInjectable(moduleDef.config, args[0], 'config');
            moduleDef.run = myself.profileInjectable(moduleDef.run, args[0], 'run');
            return moduleDef;
        });
    };

    AngularProfiler.prototype.wrapProvider = function ($provide) {
        var myself;
        myself = this;
        $provide.provider = this.delegation($provide.provider, function (args) {
            if (myself.angular.isFunction(args[1]) || myself.angular.isArray(args[1])) {
                args[1] = myself.profileInjectable(args[1], args[0], 'provide');
            } else if (args[1].$get) {
                args[1].$get = myself.profileInjectable(args[1].$get, args[0], 'provide.$get');
            }
        });
    };

    AngularProfiler.prototype.wrapService = function ($provide) {
        var myself;
        myself = this;
        $provide.service = this.delegation($provide.service, function (args) {
            args[1] = myself.profileInjectable(args[1], args[0], 'service');
        });
    };

    AngularProfiler.prototype.wrapWatchers = function (scope) {
        var myself;

        // scope.$$watchers is null or is an array
        // Each watcher is {
        //     fn: listener function
        //     last: last value
        //     get:  getter, based on exp
        //     exp:  watch expression
        //     eq:  boolean for object equality
        // }
        if (!scope.$$watchers) {
            return;
        }

        myself = this;
        this.angular.forEach(scope.$$watchers, function (watcher) {
            var exp, hint, listener, methodName, objectName;

            if (myself.watcherHints.length) {
                hint = myself.watcherHints[myself.watcherHints.length - 1];
            } else if (typeof watcher.exp === 'function') {
                hint = myself.functionName(watcher.exp);
            } else {
                hint = watcher.exp;
            }

            if (typeof watcher.exp === 'function') {
                exp = myself.functionName(exp);
            } else {
                exp = JSON.stringify(watcher.exp);
            }

            listener = myself.functionName(listener);

            // This has the hint inside a hint, which makes it look bad,
            // but at least tells you exactly what was making a watcher
            // and to which scope the watcher was added.
            objectName = 'scope(' + scope.$id + ')';
            methodName = '$watch(' + hint + ').exp';
            watcher.get = myself.profileInjectable(watcher.get, objectName, methodName, exp);
            watcher.get = myself.wrapWatchLogger(watcher.get, objectName, methodName, watcher);
            watcher.fn = myself.profileInjectable(watcher.fn, 'scope(' + scope.$id + ')', '$watch(' + hint + ').listener', exp + ',' + listener);

            // Set the flag so we skip wrapping the functions a second time
            watcher.timeMap = true;
        });
    };

    AngularProfiler.prototype.wrapWatchLogger = function (getter, objectName, methodName, watcher) {
        var myself;

        function isDifferent(value, last) {
            if (value === last) {
                return false;
            }

            if (watcher.eq) {
                return !myself.angular.equals(value, last);
            }

            if (typeof value === 'number' && typeof last === 'number' && isNaN(value) && isNaN(last)) {
                return false;
            }

            return true;
        }

        myself = this;

        return function () {
            var result;
            result = getter.apply(this, Array.prototype.slice.apply(arguments));

            if (myself.logWatchChanges && isDifferent(result, watcher.last)) {
                console.log('--> ' + objectName + '.' + methodName, result, watcher.last);
            }

            return result;
        };
    };


    var angularProfiler;
    angularProfiler = new AngularProfiler(wind.angular);

    return angularProfiler;
}(this));
