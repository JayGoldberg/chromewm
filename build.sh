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
NC='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'

JS_COMPILER_PARAMETERS="\
--compilation_level=SIMPLE \
--jscomp_error=missingRequire \
--jscomp_warning=accessControls \
--jscomp_warning=constantProperty \
--jscomp_warning=const \
--jscomp_warning=deprecated \
--jscomp_warning=deprecatedAnnotations \
--jscomp_warning=extraRequire \
--jscomp_warning=inferredConstCheck \
--jscomp_warning=functionParams \
--jscomp_warning=missingReturn \
--jscomp_warning=missingOverride \
--jscomp_warning=missingPolyfill \
--jscomp_warning=missingSourcesWarnings \
--jscomp_warning=newCheckTypes \
--jscomp_warning=unusedLocalVariables \
--jscomp_warning=unusedPrivateMembers \
--jscomp_warning=underscore \
--jscomp_off=reportUnknownTypes \
--jscomp_off=missingProperties \
--externs=$JS_CHROME_EXTENSIONS_API \
--hide_warnings_for=goog"
#--jscomp_off=unknownDefines \
#--jscomp_off=undefinedVars \
#--jscomp_off=undefinedNames \
# TODO: Replace closure builder by compiler using dependency_mode
JS_BUILDER_PARAMETERS="\
--compiler_jar=$JS_CLOSURE_COMPILER_PATH \
--root=$CLOSURE_LIBRARY_PATH \
--root=js/ \
--output_mode=compiled \
--compiler_flags=\"$JS_COMPILER_PARAMETERS\""


while read TARGET; do
  [[ "$TARGET" == "#"* || -z "$TARGET" ]] && continue
  [ ! -f $TARGET ] && echo -e "${RED}ERROR:${NC} File $TARGET doesn't exist" \
      && continue
  FILENAME=`basename $TARGET`
  # Compiles only if the source file changed.
  # TODO(): Compile if dependencies changed
 [ ! $TARGET -nt $COMPILED_PATH/$FILENAME ] && continue

  case $TARGET in
    # Compile if it's a JavaScript file
    *.js)
      echo -e "${GREEN}Compiling${NC} $TARGET"
      BUILD_TARGET=" --input=$TARGET --output_file=$COMPILED_PATH/$FILENAME"
      BUILD_COMMAND="$CLOSURE_BUILDER_PATH $JS_BUILDER_PARAMETERS $BUILD_TARGET"
      eval $BUILD_COMMAND
      ;;
    # Copy everything else
    ?*)
      echo -e "${GREEN}Coping${NC} $TARGET"
      cp $TARGET $COMPILED_PATH/$FILENAME
  esac
done < BUILD_TARGETS
