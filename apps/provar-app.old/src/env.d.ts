declare module "*.css" {
  const content: string;
  export default content;
}

declare module "electrobun/types" {
  export type * from "electrobun";
}

declare module "three";
