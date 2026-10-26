import { defineConfig } from "vite";

// GitHub Pages는 https://<계정>.github.io/<저장소>/ 아래에서 열리므로 배포 빌드에서는 BASE_PATH=/samhanji/ 를 준다.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
});
