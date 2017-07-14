#!/bin/bash
#
# Script to build the extension using the Google Closure Library
#

############################################################
# Replace the following with the paths in your environment #
############################################################
OUTPUT_PATH="bin"
JS_CLOSURE_COMPILER_PATH="../third_party/bin/closure-compiler.jar"
JS_CLOSURE_LIBRARY_PATH="../third_party/closure-library"
JS_COMPILER_LEVEL="SIMPLE"
  # SIMPLE: Makes debugging Errors easier as variables keep their names
  # ADVANCED: Switch to ADVANCED during final builds

# Add all necessary externs
JS_EXTERNS="\
../third_party/closure-compiler/contrib/externs/chrome_extensions.js \
"


###################################
#  Do not modify bellow this line #
###################################
NC='\033[0m'
RED='\033[0;31m'
GREEN='\033[0;32m'

JS_COMPILER_BASIC="\
--compilation_level=$JS_COMPILER_LEVEL \
--dependency_mode=STRICT \
"

JS_COMPILER_EXTRAS="\
--externs=$JS_EXTERNS \
--js \"$JS_CLOSURE_LIBRARY_PATH/closure/goog/**.js\" \
--js \"\!$JS_CLOSURE_LIBRARY_PATH/closure/goog/**test.js\" \
--js \"./**.js\" \
"

JS_COMPILER_CHECKS="\
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
--hide_warnings_for=goog "
#--jscomp_off=unknownDefines \
#--jscomp_off=undefinedVars \
#--jscomp_off=undefinedNames \
#TODO(): Unhide goog and enable and solve the warnings flagged as off?


JS_COMPILER_PARAMETERS="\
$JS_COMPILER_BASIC $JS_COMPILER_CHECKS $JS_COMPILER_EXTRAS\
"

JS_COMPILER="java -jar $JS_CLOSURE_COMPILER_PATH"

###### Functions ######
function getNamespace {
  while read line; do
    if [[ "$line" == "goog.provide"* ]]; then
      lineMinusPrefix=${line#*\'}
      nameSpace=${lineMinusPrefix%\'*}
      echo $nameSpace
      return
    fi
  done < $1
}

###### Actual Program Starts bellow ######
mkdir -p $OUTPUT_PATH

while read TARGET; do
  [[ "$TARGET" == "#"* || -z "$TARGET" ]] && continue
  [ ! -f $TARGET ] && echo -e "${RED}ERROR:${NC} File $TARGET doesn't exist" \
      && continue
  FILENAME=`basename $TARGET`
  # Compiles only if the source file changed.
  # TODO(): Compile if dependencies changed
 [ ! $TARGET -nt $OUTPUT_PATH/$FILENAME ] && continue

  case $TARGET in
    # Compile if it's a JavaScript file
    *.js)
      echo -e "${GREEN}Compiling${NC} $TARGET"
      NAME_SPACE=$(getNamespace $TARGET)
      BUILD_TARGET="--entry_point=$NAME_SPACE --js_output_file=$OUTPUT_PATH/$FILENAME"
      BUILD_COMMAND="$JS_COMPILER $JS_COMPILER_PARAMETERS $BUILD_TARGET"
      eval $BUILD_COMMAND
      ;;
    # Copy everything else
    # TODO(): Allow to use wildcards in BUILD_TARGETS file
    ?*)
      echo -e "${GREEN}Coping${NC} $TARGET"
      cp $TARGET $OUTPUT_PATH/$FILENAME
  esac
done < BUILD_TARGETS
echo -e "${GREEN}Build Completed!${NC}"
