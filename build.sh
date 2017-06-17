#!/bin/bash
#
# Script to build the extension using the Google Closure Library
#

############################################################
# Replace the following with the paths in your environment #
############################################################
JS_CLOSURE_COMPILER_PATH=../thirdparty/bin/closure-compiler.jar
CLOSURE_BUILDER_PATH=../thirdparty/closure-library/closure/bin/build/closurebuilder.py
CLOSURE_LIBRARY_PATH=../thirdparty/closure-library/
JS_CHROME_EXTENSIONS_API=../thirdparty/closure-compiler/contrib/externs/chrome_extensions.js
COMPILED_PATH=bin

###################################
#  Do not modify bellow this line #
###################################
JS_COMPILER_PARAMETERS="\
--compilation_level=ADVANCED \
--jscomp_error=missingRequire \
--jscomp_warning=accessControls \
--jscomp_warning=constantProperty \
--jscomp_warning=const \
--jscomp_warning=deprecated \
--jscomp_warning=deprecatedAnnotations \
--jscomp_warning=extraRequire \
--jscomp_warning=inferredConstCheck \
--jscomp_warning=missingReturn \
--jscomp_warning=newCheckTypes \
--jscomp_warning=functionParams \
--jscomp_warning=missingOverride \
--jscomp_warning=missingPolyfill \
--jscomp_warning=missingSourcesWarnings \
--jscomp_warning=unusedLocalVariables \
--jscomp_warning=unusedPrivateMembers \
--jscomp_warning=underscore \
--externs=$JS_CHROME_EXTENSIONS_API \
--hide_warnings_for=goog"

# TODO: Replace closure builder by compiler using dependency_mode
JS_BUILDER_PARAMETERS="\
--compiler_jar=$JS_CLOSURE_COMPILER_PATH \
--root=$CLOSURE_LIBRARY_PATH \
--root=. \
--output_mode=compiled \
--compiler_flags=\"$JS_COMPILER_PARAMETERS\""


while read TARGET; do
  case $TARGET in
    # Ignore if it's a comment
    \#*)
      continue
      ;;

    # Compile if it's a JavaScript file
    *.js)
      echo "Compiling $TARGET"
      BUILD_TARGET=" --input=$TARGET --output_file=$COMPILED_PATH/$TARGET"
      BUILD_COMMAND="$CLOSURE_BUILDER_PATH $JS_BUILDER_PARAMETERS $BUILD_TARGET"
      eval $BUILD_COMMAND
      ;;

    # Copy everything else unless it's an empty file in BUILD_TARGETS)
    ?*)
      echo "Coping $TARGET"
      cp $TARGET $COMPILED_PATH/$TARGET
  esac
done < BUILD_TARGETS
