// import { join } from "node:path";
// import fileSystem from "fs-extra";
// import { BuildStoreConfig } from "./BuildStoreConfig";
// import { TPackage, getPackagesInfos } from "./getFrameworkPackages.js";
// import inquirer from "inquirer";
// import color from "chalk";

// async function getTestDirectories(rootPath: string): Promise<string[]> {
//   try {
//     const testsPath = join(rootPath, "tests");

//     await fileSystem.ensureDir(testsPath);
//     let filesAndDirectories = await fileSystem.readdir(testsPath);
//     let testDirectories: string[] = [];
//     await Promise.all(
//       filesAndDirectories.map(async (name) => {
//         const testPath = join(testsPath, name);
//         const stat = await fileSystem.stat(testPath);
//         if (stat.isDirectory()) {
//           testDirectories.push(testPath);
//         }
//       })
//     );
//     console.log(testDirectories);
//     return testDirectories;
//   } catch (e) {
//     throw e;
//   }
// }

// async function promptTest(tests: TPackage[]): Promise<string> {
//   try {
//     const availableTests = tests.map((test) => {
//       return test.name;
//     });
//     const userRequest = await inquirer.prompt({
//       type: "list",
//       name: "test",
//       message: color.cyan("Please provide a test to execute in the browser"),
//       validate: (answer) => {
//         if (answer.length < 1) {
//           return "You MUST provide a test.";
//         }
//         return true;
//       },
//       choices: availableTests
//     });
//     return userRequest.test as string;
//   } catch (e) {
//     throw e;
//   }
// }

// export async function promptUserTest(
//   buildStoreConfig: BuildStoreConfig
// ): Promise<TPackage> {
//   try {
//     const testDirectories = await getTestDirectories(buildStoreConfig.rootPath);
//     // console.log(testDirectories);
//     const packagesInfos = await getPackagesInfos(testDirectories);
//     const choosenTest = await promptTest(packagesInfos);
//     const foundTest = packagesInfos.find((packageInfo) => {
//       return (packageInfo as unknown as TPackage).name === choosenTest;
//     }) as TPackage;
//     console.log(foundTest);
//     return foundTest;
//   } catch (err) {
//     throw err;
//   }
// }

// export async function promptIfTest(): Promise<boolean> {
//   try {
//     const answer = await inquirer.prompt({
//       type: "list",
//       name: "hasTest",
//       message: `${color.cyan("Do you want to make a test in the browser")} ?`,
//       choices: [
//         { name: "Yes", value: true },
//         { name: "No", value: false }
//       ]
//     });
//     return answer.hasTest as boolean;
//   } catch (err) {
//     throw err;
//   }
// }
