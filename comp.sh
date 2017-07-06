#!/bin/bash
# With jar compiler

# No compila bien, problemas para cerrar windows en viejos workspaces

############################################################
# Replace the following with the paths in your environment #
############################################################
ENTRY="chromewm.background"
OUTPUT="bin/background.js"
EXTERNS="../thirdparty/closure-compiler/contrib/externs/chrome_extensions.js"
CLOSURE_LIBRARY_PATH="../thirdparty/closure-library"
COMPILER="java -jar ../thirdparty/bin/closure-compiler.jar"


###################################
#  Do not modify bellow this line #
###################################
BASICS="\
--compilation_level ADVANCED \
--dependency_mode STRICT \
--js_output_file $OUTPUT \
"

EXTRAS="\
--externs $EXTERNS \
--js \"$CLOSURE_LIBRARY_PATH/closure/goog/**.js\" \
--js \"\!$CLOSURE_LIBRARY_PATH/closure/goog/**test.js\" \
--js \"./**.js\" \
"

BUILD_COMMAND="$COMPILER $BASICS $EXTRAS --entry_point $ENTRY"
echo $BUILD_COMMAND
eval $BUILD_COMMAND
