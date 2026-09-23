import { db } from "@data/prisma/client";
import { coreRepositories } from "./prisma/core";
import { learningRepositories } from "./prisma/learning";
import type { RepositoryContext, UnitOfWork } from "./contracts";
import type { Prisma } from "@prisma/client";
const context = (client: Prisma.TransactionClient): RepositoryContext => ({
  ...coreRepositories(client),
  ...learningRepositories(client),
});
export const repositories: UnitOfWork = {
  ...context(db),
  transaction: (work, options) =>
    db.$transaction((tx) => work(context(tx)), options),
};
export type { RepositoryContext, UnitOfWork } from "./contracts";
