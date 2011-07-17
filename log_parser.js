define(function(require, exports, modules) {
  var LogParser = {};
  
  /* Lines in the LaTeX log are hard wrapped at 80 characters.
   * For parsing we want the real lines so we unwrap them by combining
   * any lines that are 80 characters long with the next one. Lines
   * are returned in an array for easy parsing.
   */
  LogParser.unWrapContent = function(content) {
    var unwrapped_lines = [];
    // We want to ensure a new line at the end
    content = content.replace("\\n$", "");
    content = content + "\n";
    
    var wrapped_lines = content.split("\n");
    var wrap_next = true; // push first line
    var current_line = '';
    for (var i = 0; i < wrapped_lines.length; i++) {
      line = wrapped_lines[i];
      if (wrap_next) {
        current_line += line;
      } else {
        unwrapped_lines.push(current_line);
        current_line = line;
      }
      wrap_next = (line.length >= 79);
    }
    return unwrapped_lines;
  };
  
  /* Extract errors and warnings from the log.
   * 
   * Errors are signified by a ! at the beginning of a line and then
   * later on come with a line number in the format of 'l.15' at the 
   * beginning of the line.
   *
   * Warnings are less consistent but two common ones are 
   *   LaTeX Warning: Blah
   *   Package natbib Warning: Blah
   * so we seach for the 'Warning:' part.
   *
   * Keeping track of the current file being parsed by the log is the 
   * hard part. Files are grouped with their content with parentheses. 
   * If a file has no output, it comes tightly wrapped with parentheses. If
   * it does have content it tends to come in the form:
   *   (/path/to/file.tex
   *   Log line
   *   Log line
   *   )
   * The last bracket is either on its own or followed by a space and another
   * opening parenthesis and file block.
   */
  LogParser.parse = function(content) {  
    var lines = LogParser.unWrapContent(content).reverse();
    var root_file = { contents: [] };
    var current_file = root_file;
    var file_stack = [];
    var current_line;
    var new_file, m;
    var current_error;
    var errors = [];
    var warnings = [];
    
    // Useful Regular Expressions
    // --------------------------
    var whiteSpaceRegEx = ' *';
    // At the moment we only exclude a / but should maybe be more strict.
    var fileNameRegEx = '[^/]+';
    // A directory like foo/ or foo/bar/ without a leading /. We assume at least one
    // slash.
    var relativeDirRegEx = '(?:' + fileNameRegEx + '/)+';
    var relativePathRegEx = '(?:(?:' + relativeDirRegEx + fileNameRegEx + ')|(?:' + fileNameRegEx + '))';
    var absolutePathRegEx = '/' + relativePathRegEx;
    var projectPathRegEx = relativeDirRegEx + '/' + relativePathRegEx;
    // A file is either in the project or referenced by its absolute path
    var pathRegEx = '(?:(?:' + absolutePathRegEx + ')|(?:' + projectPathRegEx + '))';
    // These are number blocks that sometimes appear all over LaTeX logs.
    // They are like [19] [20]
    var numberBlockRegEx = '\\[[0-9]+\\]';
    // Matches an options set of these number blocks
    var numberBlocksRegEx = '(?:(?:' + numberBlockRegEx + whiteSpaceRegEx + ')*' + numberBlockRegEx + ')?';
    // These numbers sometimes have an error like [20 <error>], however
    // ending, >] always appears on a new line.
    var leadingOptionalNumberBlocksRegEx = '(?:>])?' + numberBlocksRegEx;
    // At the end of a file path there are sometimes number blocks or partial
    // number blocks like '[19'
    var trailingNumberBlocksRegEx = whiteSpaceRegEx + numberBlocksRegEx + whiteSpaceRegEx + '\\[[0-9]+\\]?' + whiteSpaceRegEx;
    
    
    while (lines.length > 0) {
      line = lines.pop();
      
      // Match a file without log output and therefore tightly wrapped by
      // parentheses on the same line.
      if (m = line.match('^' + whiteSpaceRegEx + '\\((' + pathRegEx + ')\\)(.*)$')) {
        current_file.contents.push({
          path     : m[1],
          contents : []
        })
        
        // The remainder of the line may need further parsing.
        lines.push(m[2]);
        
      // Match the beginning of a file block with content, so only the first
      // parenthesis is on this line.
      } else if (m = line.match('^' + whiteSpaceRegEx + '\\((' + pathRegEx +')$')) {
        var path = m[1]
        
        // Remove trailing number blocks like '[2]' or '[19'
        if (m = path.match(trailingNumberBlocksRegEx + '$')) {
          path = path.replace(m[0], '');
        }
        // Remove trailing whitespace
        path = path.replace(/ *$/, '');
        
        new_file = {
          path     : path,
          contents : []
        };
        current_file.contents.push(new_file)
        file_stack.push(current_file);
        current_file = new_file;
        
      // A closing parenthesis at the beginning of line closes the current
      // file block. This is sometimes preceded by numbers like [9] [10]
      } else if (m = line.match('^' + leadingOptionalNumberBlocksRegEx + '\\)(.*)$')) {
        if (file_stack.length > 0) {
          current_file = file_stack.pop();
        } else {
          // We've gone out of sync. Keep going and hope for something 
          // not nonsensical.
          current_file = root_file;
        }
        
        // The remainder of the line may need further parsing.
        lines.push(m[1]);
        
      // Warnings have ill defined syntax, but normally come with a 
      // 'Warning:' label somewhere.
      } else if (m = line.match(/(.*) Warning:(.*)$/)) {
        current_file.path = (current_file.path || '');
        warnings.push({
          file: current_file.path,
          message: m[2]
        });
      } else {
        // An error description begins with a ! and a summary of the 
        // error on the same line. Error descriptions tend to end with a
        // a double new line.          
        if (m = line.match(/^! *(.*)/)) {
          // Beginning of Error
          current_file.path = (current_file.path || '');
          current_error = {
            file: current_file.path,
            message: m[1],
            content: '',
            line: 0
          };
          errors.push(current_error);
        // Line numbers for errors are given sometime after the ! declaration
        // and always start with 'l.'
        } else if (m = line.match(/^l\.([0-9]+)/)) {
          if (current_error !== undefined) {
            current_error.line = parseInt(m[1]);
          }
          
        // We have a regular line that is just content. If we are in an error,
        // then add to the description.
        } else {
          if (current_error !== undefined) {
            // Sometimes we get a double new line immediately after the !
            // declaration but this doesn't mark the end of the error. We 
            // only end the error on a double new line if it already has 
            // content.
            if (line == '' && current_error.line != 0) {
              current_error = undefined;
            } else {
              current_error.content += line + "\n";
            }
          }
        }
      }
    }
          
    return {
      errors   : errors,
      warnings : warnings,
      files    : file_stack
    };
  }
  
  return LogParser;
});

