#! /bin/bash

# getting git hook directory
ROOT_DIR=$(git rev-parse --show-toplevel)
HOOK_DIR=$ROOT_DIR/.git/hooks
REPO_HOOKS=$ROOT_DIR/git/hooks
WRAPPER_PATH=$ROOT_DIR/git/hook-wrapper

find "$REPO_HOOKS" -type f | while read filename; do
    # look for files files that don't have extentions such as .file .txt etc.
    if [[ ! $filename =~ \.[a-zA-Z0-9]+$ ]]; then
        hook=$(basename "$filename")
        # check to see if .git/hook has the same code as in my wrapper
        # if yes, then we ignore this statement
        if [ -f "$HOOK_DIR/$hook" ]; then
            # if .local files already exist
            difference=$(diff -q --strip-trailing-cr "$WRAPPER_PATH" "$HOOK_DIR/$hook")
            if [[ $difference =~ \w+ ]]; then
                # if .local files doesn't exist
                if [ ! -f "$HOOK_DIR/$hook.local" ]; then
                    # if file exist and is executable
                    if [ ! -h "$HOOK_DIR/$hook" ] && [ -x "$HOOK_DIR/$hook" ]; then
                        # move file to proper .git/hooks folder
                        mv "$HOOK_DIR/$hook" "$HOOK_DIR/$hook.local"
                    else
                        echo INFO: no "$hook.local" hook file found or not executable
                    fi
                else
                    echo WARNING: "$HOOK_DIR/$hook.local" already exists
                fi

                # symlink move wrapper code to .git/hook
                if [ -a "$WRAPPER_PATH" ]; then
                    # moving wrapper to .git/hook
                    ln -s -f "$WRAPPER_PATH" "$HOOK_DIR/$hook"
                else
                    # if file doesn't exist throw error
                    echo ERROR: missing git/wrapper file
                fi
            else
                echo INFO: "$hook" already set
            fi
        else
            # symlink move wrapper code to .git/hook
            if [ -a "$WRAPPER_PATH" ]; then
                # moving wrapper to .git/hook
                ln -s -f "$WRAPPER_PATH" "$HOOK_DIR/$hook"
            else
                # if file doesn't exist throw error
                echo ERROR: missing git/wrapper file
            fi
        fi
    fi
done
