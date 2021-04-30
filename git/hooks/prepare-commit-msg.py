# importing system and regex matching
import sys, re
# if python version is 3 or higher
if sys.version_info.major != 3:
    print("Your python version is not supported by this script. Please update or set 'python' to be version 3.4+")
    exit(1)
else:
    from subprocess import getoutput

getting file path
commit_msg_filepath = sys.argv[1]

# gettting current branch
branch = getoutput('git symbolic-ref --short HEAD').strip()
# regex the commit and Trim it down to get the parts we're interested in
regex = '(feature|hotfix|bug|.*?)\/(\w+-\d+)'
# checking to see if our trimmed message matches the branch name
if re.match(regex, branch):
    # save the second index that of branch that matches regex part
    issue = re.match(regex, branch).group(2)
    # ???
    commit_regex = rf'\[{issue}\]'
    # opening file path comit message file as read write
    with open(commit_msg_filepath, 'r+') as fh:
        # save comit message from file
        commit_msg = fh.read()
        # new commit message to not overrite original
        new_commit_msg = commit_msg
        # ????
        if (not re.search(commit_regex, commit_msg)):
            # writing a new commmit message %s is new string issue + commit message
            new_commit_msg = '[%s] %s' % (issue, commit_msg)
            # print adding issue 
            print("appended " + issue + " to message\n")    
        # new commit message
        print (new_commit_msg)
        # looking for first position in file
        fh.seek(0, 0)
        # write to new message to file
        fh.write(new_commit_msg)