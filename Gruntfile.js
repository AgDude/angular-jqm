var path = require('path');
var fs = require('fs');

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('./package.json'),
    concat: {
      nodeps: {
        options: {
          banner: grunt.file.read('build/header.js'),
          footer: grunt.file.read('build/footer.js')
        },
        src: ['src/module.js', 'src/**/*.js'],
        dest: 'dist/<%= pkg.name %>-nodeps.js'
      },
      all: {
        src: ['<%= concat.nodeps.dest %>',
          'bower_components/angular-scrolly/angular-scrolly.js',
          'bower_components/bootstrap/src/position/position.js'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },
    
    inlineTemplate: {
      //Output files in same spot with inline templates
      options: {
        base: 'src'
      },
      all: {
        files: {
          '<%= concat.nodeps.dest %>': '<%= concat.nodeps.dest %>',
          '<%= concat.all.dest %>': '<%= concat.all.dest %>'
        }
      }
    },

    sass: {
      all: {
        options: {
          style: 'compressed'
        },
        src: ['src/css/main.scss'],
        dest: 'dist/angular-jqm.css'
      }
    },

    uglify: {
      options: {
        preserveComments: 'some'
      },
      all: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['dist/<%= pkg.name %>.js']
        }
      }
    },

    watch: {
      options: {
        atBegin: true
      },
      files: ['src/**/*','test/**/*'],
      tasks: ['quickbuild', 'karma:dev:run', 'notify']
    },

    notify: {
      all: {
        options: {
          title: "angular-jqm",
          message: "grunt dev: Build Complete"
        }
      }
    },

    jshint: {
      options: {
        jshintrc: __dirname + '/.jshintrc'
      },
      dist: {
        files: {
          src: ['<%= concat.nodeps.dest %>']
        },
        options: {
          globals: {
            angular: true,
            window: true
          }
        }
      },
      test: {
        files: {
          src: ['test/unit/**/*.js']
        }
        //options moved to .jshintrc
      }
    },

    connect: {
      server: {
        options: {
          port: 9000,
          base: './',
          hostname: ''
        }
      }
    },

    karma: {
      options: {
        configFile: 'test/config/karma-shared.conf.js',
      },
      dev: {
        options: {
          singleRun: false,
          browsers: ['Chrome']
        },
        background: true
      },
      //We're only allowed two concurrent browsers on saucelabs
      sauce1: {
        configFile: 'test/config/karma-saucelabs.conf.js',
        browsers: ['sauce_ie'/*, 'sauce_firefox'*/], //firefox removed for now because it was failing
      },
      sauce2: {
        configFile: 'test/config/karma-saucelabs.conf.js',
        //Boot up both mobile browsers at once, since they take alot longer to start
        browsers: ['sauce_ios', 'sauce_android'],
      },
      localBuild: {
        options: {
          singleRun: true,
          //Travis CI has firefox, we use it
          browsers: [process.env.TRAVIS ? 'Firefox' : 'Chrome']
        }
      }
    },

    changelog: {
      dest: 'CHANGELOG.md'
    },

    ngdocs: {
      options: {
        dest: 'dist/docs/',
        scripts: [
          'docs/scripts/jquery.mobile.css.js',
          'angular.js',
          'bower_components/angular-scrolly/angular-scrolly.js',
          'docs/scripts/angular-scrolly-docs.js'
        ],
        styles: [
          /* TODO css stylesheets are not put into jsfiddles,
             so we use a javascript that adds the style (jquery.mobile.css.js)
             '//cdnjs.cloudflare.com/ajax/libs/jquery-mobile/1.3.1/jquery.mobile.css'
             */
          'docs/scripts/example_resets.css'
        ],
        navTemplate: 'docs/template/nav.html',
        html5Mode: false,
        startPage: '/api',
        title: '<%= pkg.name %>'
      },
      guide: {
        src: ['docs/content/guide/**/*.ngdoc'],
        title: 'Guide'
      },
      api: {
        src: ['src/**/*.js', 'docs/content/api/**/*.ngdoc'],
        title: 'API Documentation'
      },

    }
  });

  grunt.registerTask('build', ['quickbuild', 'uglify']);
  grunt.registerTask('quickbuild', ['commit-hook', 'sass', 'concat', 'inlineTemplate']);
  grunt.registerTask('dev', ['connect','karma:dev','watch']);
  grunt.registerTask('default', ['build','jshint','karma:localBuild','ngdocs']);

  grunt.registerTask('commit-hook', commitHook);

  function commitHook() {
    if (!grunt.file.exists('.git/hooks/commit-msg')) {
      grunt.file.copy('build/validate-commit-msg.js', '.git/hooks/commit-msg');
      require('fs').chmodSync('.git/hooks/commit-msg', '0755');
      grunt.log.writeln('Installing commit enforce hook.');
    }
  }
};
