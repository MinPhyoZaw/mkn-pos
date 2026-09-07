const { ipcMain } = require("electron");
const { getPrisma } = require("../services/database.cjs");

function normalizeCategoryName(value) {
  return String(value ?? "").trim();
}

ipcMain.handle("categories:getAll", async () => {
  return getPrisma().category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: "asc" },
  });
});

ipcMain.handle("categories:create", async (_event, data) => {
  const prisma = getPrisma();
  const name = normalizeCategoryName(data?.name);

  if (!name) {
    throw new Error("Category name is required.");
  }

  try {
    return await prisma.category.create({
      data: { name },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new Error("A category with this name already exists.");
    }
    throw error;
  }
});

ipcMain.handle("categories:update", async (_event, id, data) => {
  const prisma = getPrisma();
  const name = normalizeCategoryName(data?.name);

  if (!name) {
    throw new Error("Category name is required.");
  }

  try {
    return await prisma.category.update({
      where: { id: Number(id) },
      data: { name },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw new Error("A category with this name already exists.");
    }
    if (error?.code === "P2025") {
      throw new Error("Category not found.");
    }
    throw error;
  }
});

ipcMain.handle("categories:delete", async (_event, id) => {
  const prisma = getPrisma();
  const categoryId = Number(id);
  const productCount = await prisma.product.count({
    where: { categoryId },
  });

  if (productCount > 0) {
    throw new Error("This category contains products. Move or remove those products before deleting the category.");
  }

  await prisma.category.delete({
    where: { id: categoryId },
  });
});
