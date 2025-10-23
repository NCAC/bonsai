import vinylFileSystem from "vinyl-fs";
import prettier from "gulp-prettier";

export function prettyDtsFile(
  outDtsFile: string,
  distPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    vinylFileSystem
      .src(outDtsFile)
      .pipe(prettier())
      .pipe(vinylFileSystem.dest(distPath))
      .on("error", reject)
      .on("end", resolve);
  });
}

export function prettyOutJsFile(
  outJsFile: string,
  distPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    vinylFileSystem
      .src(outJsFile)
      .pipe(prettier())
      .pipe(vinylFileSystem.dest(distPath))
      .on("error", reject)
      .on("end", resolve);
  });
}