module.exports = function (grunt) {
    'use strict';

    var sauceLaunchers;

    function config(override) {
        var result;

        result = {
            autoWatchBatchDelay: 1000,
            browsers: [
                'PhantomJS'
            ],
            frameworks: [
                'jasmine'
            ],
            options: {
                files: [
                    'lib/time-map.js',
                    'test/**/*.js'
                ]
            },
            plugins: [
                'karma-jasmine',
                'karma-phantomjs-launcher',
                'karma-sauce-launcher'
            ],
            reporters: [
                'progress'
            ],
            sauceLabs: {
                accessKey: process.env.SAUCE_ACCESS_KEY,
                testName: 'bloom-health tests',
                username: process.env.SAUCE_USERNAME
            },
            singleRun: true
        };

        if (process.env.TRAVIS) {
            result.sauceLabs.build = 'Travis #' + process.env.TRAVIS_BUILD_NUMBER + ' (' + process.env.TRAVIS_BUILD_ID + ')';
            result.sauceLabs.startConnect = false;
            result.sauceLabs.tunnelIdentifier = process.env.TRAVIS_JOB_NUMBER;

            // Remove this once websockets are supported by Sauce + Travis
            // See angularjs's karma.shared.conf
            result.transports = [
                'xhr-polling'
            ];
        }

        if (override) {
            Object.keys(override).forEach(function (key) {
                result[key] = override[key];
            });
        }

        return result;
    }

    // Limit to 3 for a FOSS account
    sauceLaunchers = {
        win7Firefox: {
            base: 'SauceLabs',
            browserName: 'firefox',
            platform: 'Windows 7'
        },
        osx109Iphone: {
            base: 'SauceLabs',
            browserName: 'iphone',
            platform: 'OS X 10.9'
        },
        winxpIe8: {
            base: 'SauceLabs',
            browserName: 'internet explorer',
            platform: 'Windows XP',
            version: 8
        }
    };

    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-jasmine-node');
    grunt.loadNpmTasks('grunt-jslint');
    grunt.initConfig({
        jasmine_node: {
            all: [
                'lib/',
                'test/'
            ]
        },
        jslint: {
            all: {
                src: [
                    'Gruntfile.js',
                    'lib/**/*.js',
                    'package.json',
                    'test/**/*.js'
                ],
                directives: {
                    predef: [
                        'exports',
                        'module',
                        'process',
                        'require'
                    ]
                },
                options: {
                    errorsOnly: true
                }
            }
        },
        karma: {
            sauce: config({
                browserDisconnectTimeout: 10000,
                browserDisconnectTolerance: 2,
                browsersNoActivityTimeout: 20000,
                browsers: Object.keys(sauceLaunchers),
                captureTimeout: 120000,
                customLaunchers: sauceLaunchers,
                reporters: [
                    'dots',
                    'saucelabs'
                ]
            }),
            unit: config(),
            watch: config({
                singleRun: false,
                watch: true
            })
        }
    });

    if (process.env.TRAVIS) {
        grunt.registerTask("test", [
            "jslint",
            "jasmine_node",
            "karma:sauce"
        ]);
    } else {
        grunt.registerTask("test", [
            "jslint",
            "jasmine_node",
            "karma:unit"
        ]);
    }
};
