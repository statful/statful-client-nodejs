'use strict';
module.exports = function (grunt) {

    // Show elapsed time at the end
    require('time-grunt')(grunt);

    // Load all grunt tasks
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish')
            },
            gruntfile: {
                src: ['Gruntfile.js']
            },
            js: {
                src: ['lib/**/*.js']
            },
            test: {
                src: ['spec/**/*.js']
            }
        },
        mochaTest: {
            test: {
                src: ['spec/*.js']
            }
        },
        mocha_istanbul: {
            coveralls: {
                src: ['spec'],
                options: {
                    check: {
                        lines: 93,
                        statements:93,
                        branches: 83,
                        functions: 89
                    },
                    root: './lib',
                    reportFormats: ['lcov']
                }
            }
        },
        bump: {
            options: {
                files: ['package.json'],
                updateConfigs: [],
                commit: true,
                commitMessage: 'Bump version v%VERSION%',
                commitFiles: ['package.json'],
                createTag: true,
                tagName: '%VERSION%',
                tagMessage: 'Version %VERSION%',
                push: true,
                pushTo: 'origin',
                gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
                globalReplace: false,
                prereleaseName: false,
                regExp: false
            }
        }
    });


    grunt.registerTask('test', [
        'jshint',
        'mochaTest',
        'mocha_istanbul'
    ]);

    grunt.registerTask('default', [
        'test'
    ]);

    grunt.registerTask('release:major', [
        'bump:major'
    ]);

    grunt.registerTask('release:minor', [
        'bump:minor'
    ]);

    grunt.registerTask('release:patch', [
        'bump:patch'
    ]);
};