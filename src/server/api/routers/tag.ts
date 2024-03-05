import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { LangZod } from "../utils";

export const tagRouter = createTRPCRouter({
  findMany: publicProcedure
    .input(
      z
        .object({
          select: z
            .array(z.enum(["name", "type", "introduce", "count"]))
            .optional(),
          type: z.string().or(z.null()).optional(),
          page: z.number().optional().default(1),
          pageSize: z.number().optional().default(28),
          lang: LangZod,
        })
        .optional(),
    )
    .query(async ({ ctx, input = {} }) => {
      const { select = ["name", "type", "introduce"] } = input;

      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 28;

      const [total, data] = await ctx.db.$transaction([
        ctx.db.tag.count({
          where: {
            type: {
              equals: input.type,
            },
          },
        }),
        ctx.db.tag.findMany({
          where: {
            type: {
              equals: input.type,
            },
          },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: select.includes("name"),
            type: select.includes("type"),
            introduce: select.includes("introduce"),
            _count: select.includes("count")
              ? {
                  select: {
                    poems: true,
                  },
                }
              : undefined,
          },
          orderBy: {
            poems: {
              _count: "desc",
            },
          },
        }),
      ]);

      return {
        data,
        page,
        pageSize,
        hasNext: page * pageSize < total,
        total,
      };
    }),

  count: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.$transaction([
      ctx.db.tag.count(),
      ctx.db.tag.count({
        where: {
          type: "词牌名",
        },
      }),
    ]);
  }),

  findById: publicProcedure.input(z.number()).query(({ input, ctx }) =>
    ctx.db.tag.findFirst({
      where: { id: input },
    }),
  ),

  deleteById: publicProcedure
    .input(z.number())
    .mutation(({ input, ctx }) => ctx.db.tag.delete({ where: { id: input } })),

  create: publicProcedure
    .input(
      z.object({
        id: z.number().optional(),
        token: z.string(),
        name: z.string(),
        name_zh_Hant: z.string().optional(),
        type: z.string().optional(),
        type_zh_Hant: z.string().optional(),
        introduce: z.string().optional(),
        introduce_zh_Hant: z.string().optional(),
      }),
    )
    .mutation(({ input, ctx }) => {
      if (input.token !== process.env.TOKEN) throw new Error("Invalid token");
      const { id } = input;

      const objJson = {
        ...input,
        token: undefined,
      };

      if (id) {
        delete objJson.id;

        return ctx.db.tag.update({
          where: { id },
          data: objJson,
        });
      }

      return ctx.db.tag.create({
        data: objJson,
      });
    }),
});
