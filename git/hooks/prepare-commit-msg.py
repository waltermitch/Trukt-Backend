import sys, re

if sys.version_info.major != 3:
    print("Your python version is not supported by this script. Please update or set 'python' to be version 3.4+")
    exit(1)
else:
    from subprocess import getoutput

commit_msg_filepath = sys.argv[1]

# gettting current branch
branch = getoutput('git symbolic-ref --short HEAD').strip()
regex = '(?:(feature|hotfix|bug|.*?)\/)?(\w+-\d+)'

if re.match(regex, branch):
    issue = re.match(regex, branch).group(2)
    commit_regex = rf'\[{issue}\]'

    with open(commit_msg_filepath, 'r+') as fh:
        commit_msg = fh.read()
        new_commit_msg = commit_msg
        if (not re.search(commit_regex, commit_msg)):
            new_commit_msg = '[%s] %s' % (issue, commit_msg)
            print("appended " + issue + " to message\n")    
        print (new_commit_msg)
        fh.seek(0, 0)
        fh.write(new_commit_msg)