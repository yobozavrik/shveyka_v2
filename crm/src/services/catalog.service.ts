import axios from 'axios';

const KEYCRM_URL = 'https://openapi.keycrm.app/v1';
const KEYCRM_KEY = process.env.KEYCRM_API_KEY;

export interface SyncResult {
  categories: number;
  products: number;
  variants: number;
  errors: string[];
}

export class CatalogSyncService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = { categories: 0, products: 0, variants: 0, errors: [] };
    try {
      // 1. Сначала категории (чтобы было к чему привязывать)
      await this.syncCategories(result);
      // 2. Затем товары и их варианты
      await this.syncProducts(result);
      return result;
    } catch (error: any) {
      result.errors.push(`Critical error: ${error.message}`);
      return result;
    }
  }

  private async syncCategories(result: SyncResult) {
    const response = await axios.get(`${KEYCRM_URL}/products/categories`, {
      headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
    });
    const categories = response.data.data || [];
    
    for (const cat of categories) {
      const { error } = await this.supabase
        .from('product_categories')
        .upsert({
          id: cat.id,
          parent_id: cat.parent_id,
          name: cat.name,
          updated_at: new Date().toISOString()
        });
      if (!error) result.categories++;
    }
  }

  private async syncProducts(result: SyncResult) {
    let currentPage = 1;
    let lastPage = 1;

    do {
      const response = await axios.get(`${KEYCRM_URL}/products`, {
        params: { limit: 50, page: currentPage },
        headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
      });

      const products = response.data.data || [];
      lastPage = response.data.last_page || 1;

      for (const prod of products) {
        // Ищем существующую модель по keycrm_id (у вас их 1509)
        const { data: existingModel } = await this.supabase
          .from('product_models')
          .select('id')
          .eq('keycrm_id', prod.id)
          .maybeSingle();

        let modelId: number;

        if (existingModel) {
          // Обновляем существующую
          modelId = existingModel.id;
          await this.supabase
            .from('product_models')
            .update({
              category_id: prod.category_id,
              main_image_url: prod.thumbnail_url,
              gallery_urls: prod.attachments_data || [],
              updated_at: new Date().toISOString()
            })
            .eq('id', modelId);
        } else {
          // Создаем новую, если не нашли
          const { data: newModel, error: createError } = await this.supabase
            .from('product_models')
            .insert({
              name: prod.name,
              keycrm_id: prod.id,
              category_id: prod.category_id,
              sku: prod.sku || `KCM-${prod.id}`,
              main_image_url: prod.thumbnail_url,
              gallery_urls: prod.attachments_data || [],
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createError || !newModel) continue;
          modelId = newModel.id;
        }

        result.products++;
        // Синхронизируем варианты для этой модели
        await this.syncOffers(prod.id, modelId, result);
      }
      currentPage++;
    } while (currentPage <= lastPage);
  }

  private async syncOffers(keycrmProductId: number, internalModelId: number, result: SyncResult) {
    const response = await axios.get(`${KEYCRM_URL}/offers`, {
      params: { 'filter[product_id]': keycrmProductId },
      headers: { Authorization: `Bearer ${KEYCRM_KEY}` }
    });
    const offers = response.data.data || [];

    for (const offer of offers) {
      const sizeProp = offer.properties?.find((p: any) => 
        p.name.toLowerCase().includes('размер') || p.name.toLowerCase().includes('розмір')
      );

      await this.supabase
        .from('product_variants')
        .upsert({
          id: offer.id,
          product_model_id: internalModelId, // Связываем с внутренней моделью
          sku: offer.sku,
          price: offer.price,
          purchased_price: offer.purchased_price,
          size: sizeProp ? sizeProp.value : null,
          barcode: offer.barcode,
          updated_at: new Date().toISOString()
        });
      result.variants++;
    }
  }
}
