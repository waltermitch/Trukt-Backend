# importing system and regex matching
import sys, re
# if python version is 3.4 or higher execute script
if sys.version_info.major != 3:
    print("Your python version is not supported by this script. Please update or set 'python' to be version 3.4+")
    exit(1)
else:
    from subprocess import getoutput

# getting file path
commit_msg_filepath = sys.argv[1]
# gettting current branch
branch = getoutput('git symbolic-ref --short HEAD').strip()
# regex for the 'API-###' string (feature|hotfix|BOT|bug|.*?)\/
regex = '(\w+-\d+)'
# checking to see if our trimmed message matches the branch name
if re.match(regex, branch):
    # save the second index that of branch that matches regex part
    issue = re.match(regex, branch).group(1)
    # saves new regex to check vs duplicates
    commit_regex = rf'\[{issue}\]'
    # opening file path commit message file as read write
    with open(commit_msg_filepath, 'r+') as fh:
        # save commit message from file
        commit_msg = fh.read()
        # new commit message to not overrite original
        new_commit_msg = commit_msg
        # if we cherry pick to handle duplicates
        if (not re.search(commit_regex, commit_msg)):
            # writing a new commmit message %s is new string issue + commit message
            new_commit_msg = '[%s] %s' % (issue, commit_msg)
            # print to console 
            print("Appended " + issue + " to message\n")    
        # print to console
        print (new_commit_msg)
        # looking for first position in file
        fh.seek(0, 0)
        # write to new message to file
        fh.write(new_commit_msg)