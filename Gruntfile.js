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
                src: ['*.js', 'lib/**/*.js']
            },
            test: {
                src: ['test/**/*.js']
            }
        },
        mochaTest: {
            test: {
                src: ['test/*.js']
            }
        }
    });


    grunt.registerTask('test', [
        'jshint',
        'mochaTest'
    ]);

};