"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/shared/ui/card";
import { formatCurrency } from "@/shared/lib/format-currency";
import { useCurrencyFormat } from "@/shared/lib/business-settings";

interface Category {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

interface ModifierGroup {
  id: string;
  name: string;
}

interface ProductImage {
  id?: string;
  url: string;
  alt?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export default function ProductFormPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === "new";

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(!isNew);
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const currency = useCurrencyFormat();

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    basePrice: 0,
    packagingFeeAmount: 0,
    categoryId: "",
    subcategoryId: "",
    images: [] as ProductImage[],
    isAvailable: true,
    isActive: true,
  });

  const [modifierGroups, setModifierGroups] = React.useState<ModifierGroup[]>([]);
  const [selectedModifierGroupIds, setSelectedModifierGroupIds] = React.useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = React.useState("");

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories for select
        const catRes = await fetch("/api/admin/menu/categories");
        const catJson = await catRes.json();
        setCategories(catJson.data || []);

        const mgRes = await fetch("/api/admin/menu/modifier-groups");
        if (mgRes.ok) {
          const mgJson = await mgRes.json();
          setModifierGroups(mgJson.data || []);
        }

        if (!isNew) {
          const prodRes = await fetch(`/api/admin/menu/products/${params.id}`);
          if (prodRes.ok) {
            const prodJson = await prodRes.json();
            const product = prodJson.data;
            setFormData({
              name: product.name,
              description: product.description || "",
              basePrice: product.basePrice,
              packagingFeeAmount: product.packagingFeeAmount || 0,
              categoryId: product.categoryId,
              subcategoryId: product.subcategoryId || "",
              images: product.images || [],
              isAvailable: product.availability.isAvailable,
              isActive: product.availability.isActive,
            });
            setSelectedModifierGroupIds(
              (product.modifierGroups || []).map((mg: { id: string }) => mg.id),
            );
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isNew, params.id]);

  const handleAddImage = () => {
    if (!newImageUrl) return;
    const trimmed = newImageUrl.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      setActionError("La URL de imagen debe comenzar con http:// o https://");
      return;
    }
    const newImage: ProductImage = {
      url: trimmed,
      alt: formData.name,
      sortOrder: formData.images.length,
      isPrimary: formData.images.length === 0,
    };
    setFormData(p => ({ ...p, images: [...p.images, newImage] }));
    setNewImageUrl("");
    setActionError(null);
  };

  const handleRemoveImage = (index: number) => {
    setFormData(p => {
      const newImages = p.images.filter((_, i) => i !== index);
      // If we removed the primary image, make the first one primary
      if (p.images[index].isPrimary && newImages.length > 0) {
        newImages[0].isPrimary = true;
      }
      return { ...p, images: newImages };
    });
  };

  const handleSetPrimary = (index: number) => {
    setFormData(p => ({
      ...p,
      images: p.images.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      })),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        basePrice: Number(formData.basePrice),
        packagingFeeAmount:
          Number(formData.packagingFeeAmount) > 0
            ? Number(formData.packagingFeeAmount)
            : null,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || null,
        images: formData.images,
        availability: {
          isAvailable: formData.isAvailable,
          isActive: formData.isActive,
        },
        modifierGroups: selectedModifierGroupIds.map((id) => ({ id })),
      };

      const url = isNew ? "/api/admin/menu/products" : `/api/admin/menu/products/${params.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push("/admin/menu/products");
      } else {
        const errorData = await res.json();
        setActionError(errorData.error?.message || "Ocurrió un problema al guardar.");
      }
    } catch (err) {
      console.error("Error saving product:", err);
      setActionError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveProduct = async () => {
    if (isNew || archiving) return;

    const confirmed = window.confirm(
      "Este producto dejará de aparecer en el menú. No se borrará el historial.",
    );
    if (!confirmed) return;

    setArchiving(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/admin/menu/products/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availability: {
            isActive: false,
            isAvailable: false,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setActionError(errorData?.error?.message || "No se pudo archivar el producto.");
        return;
      }

      router.push("/admin/menu/products?archived=1");
    } catch {
      setActionError("Error de conexión al archivar el producto.");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-muted-foreground">Cargando datos...</div>;
  }

  const selectedCategory = categories.find(c => c.id === formData.categoryId);
  const primaryImage = formData.images.find(img => img.isPrimary) || formData.images[0];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/admin/menu/products">
          <Button variant="ghost" size="sm">← Volver</Button>
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          {isNew ? "Nuevo Producto" : "Editar Producto"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
              <CardDescription>Detalles básicos del producto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nombre del producto"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                required
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none text-foreground">Descripción</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-white placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={`Precio base (${currency.symbol})`}
                  type="number"
                  step="0.01"
                  value={formData.basePrice}
                  onChange={(e) => setFormData(p => ({ ...p, basePrice: parseFloat(e.target.value) || 0 }))}
                  required
                />
                <Input
                  label={`Empaque por unidad (${currency.symbol})`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.packagingFeeAmount}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      packagingFeeAmount: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Galería de Imágenes</CardTitle>
              <CardDescription>Añade una o más URLs de imagen para el producto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label="URL de la imagen"
                    placeholder="https://..."
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={handleAddImage} disabled={!newImageUrl}>
                  Añadir
                </Button>
              </div>

              <div className="space-y-2">
                {formData.images.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No hay imágenes añadidas.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {formData.images.map((img, index) => (
                      <div key={index} className={`flex gap-3 rounded-lg border p-2 ${img.isPrimary ? "border-brand bg-accent" : "border-border"}`}>
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                          <img src={img.url} alt={`Imagen ${index}`} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">
                              {img.isPrimary ? "Principal" : `Imagen ${index + 1}`}
                            </span>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveImage(index)}
                              className="text-muted-foreground hover:text-danger-foreground"
                            >
                              <span className="text-xs uppercase font-bold tracking-tighter">Quitar</span>
                            </button>
                          </div>
                          {!img.isPrimary && (
                            <button 
                              type="button" 
                              onClick={() => handleSetPrimary(index)}
                              className="text-left text-xs font-medium text-muted-foreground hover:underline"
                            >
                              Marcar como principal
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categorización</CardTitle>
              <CardDescription>Ubica el producto en el menú.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none text-foreground">Categoría principal</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  value={formData.categoryId}
                  onChange={(e) => setFormData(p => ({ ...p, categoryId: e.target.value, subcategoryId: "" }))}
                  required
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium leading-none text-foreground">Subcategoría (Opcional)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                  value={formData.subcategoryId}
                  onChange={(e) => setFormData(p => ({ ...p, subcategoryId: e.target.value }))}
                  disabled={!formData.categoryId || !selectedCategory?.subcategories.length}
                >
                  <option value="">Ninguna</option>
                  {selectedCategory?.subcategories.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modificadores</CardTitle>
              <CardDescription>
                Selecciona los grupos de modificadores aplicables a este producto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modifierGroups.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">
                  No hay grupos de modificadores disponibles.
                </p>
              ) : (
                <div className="space-y-2">
                  {modifierGroups.map((mg) => (
                    <label key={mg.id} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedModifierGroupIds.includes(mg.id)}
                        onChange={(e) => {
                          setSelectedModifierGroupIds((prev) =>
                            e.target.checked
                              ? [...prev, mg.id]
                              : prev.filter((id) => id !== mg.id),
                          );
                        }}
                        className="h-4 w-4 rounded border-border text-foreground focus:ring-brand"
                      />
                      <span className="text-sm font-medium text-foreground">{mg.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Estado y Visibilidad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-foreground focus:ring-brand"
                />
                <span className="text-sm font-medium text-foreground">Publicado (Visible en menú)</span>
              </label>
              
              <label className="flex min-h-11 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData(p => ({ ...p, isAvailable: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-foreground focus:ring-brand"
                />
                <span className="text-sm font-medium text-foreground">Disponible (Hay stock)</span>
              </label>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {actionError && (
                <div className="w-full rounded-md border border-danger-strong/30 bg-danger p-3 text-sm text-danger-foreground">
                  {actionError}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Guardando..." : "Guardar Producto"}
              </Button>
              {!isNew && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-warning-strong/40 text-warning-foreground hover:bg-warning"
                  disabled={archiving || saving}
                  onClick={handleArchiveProduct}
                >
                  {archiving ? "Archivando..." : "Archivar producto"}
                </Button>
              )}
              <Link href="/admin/menu/products" className="w-full">
                <Button type="button" variant="outline" className="w-full">Cancelar</Button>
              </Link>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vista previa PWA</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="w-full max-w-[280px] rounded-[32px] border-[8px] border-foreground bg-card p-1 shadow-xl">
                <div className="overflow-hidden rounded-[24px] bg-card">
                  <div className="h-40 w-full bg-muted overflow-hidden">
                    {primaryImage ? (
                      <img src={primaryImage.url} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground text-[10px] uppercase font-bold">Sin imagen</div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-base leading-tight">{formData.name || "Nombre del producto"}</p>
                      <p className="font-bold text-foreground text-sm">{formatCurrency(formData.basePrice, currency)}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{formData.description || "Descripción del producto..."}</p>
                    {formData.packagingFeeAmount > 0 ? (
                      <p className="text-[10px] font-medium text-muted-foreground">
                        Empaque por unidad: {formatCurrency(formData.packagingFeeAmount, currency)}
                      </p>
                    ) : null}
                    <div className="pt-2">
                      <div className="w-full h-8 rounded-full bg-foreground flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Añadir</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
