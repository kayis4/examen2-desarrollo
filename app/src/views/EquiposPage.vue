<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Equipos</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/tabs/equipos/nuevo" aria-label="Nuevo equipo">
            <ion-icon slot="icon-only" :icon="add" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar v-model="q" :debounce="400" placeholder="Buscar por código o nombre" @ion-input="buscar" />
      </ion-toolbar>
      <!-- YA IMPLEMENTADO: depende de useConexion() [M7] -->
      <ion-toolbar v-if="!conectado" color="warning">
        <ion-title size="small">Sin conexión: los datos pueden estar desactualizados</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refrescar">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Skeleton al cargar la primera página -->
      <ion-list v-if="cargando && equipos.length === 0" lines="full">
        <ion-item v-for="n in 6" :key="n">
          <ion-label>
            <h3><ion-skeleton-text :animated="true" style="width: 60%" /></h3>
            <p><ion-skeleton-text :animated="true" style="width: 40%" /></p>
          </ion-label>
          <ion-skeleton-text slot="end" :animated="true" style="width: 64px; height: 22px" />
        </ion-item>
      </ion-list>

      <!-- Error al cargar -->
      <div v-else-if="error && equipos.length === 0" class="estado-vacio ion-padding ion-text-center">
        <ion-icon :icon="cloudOfflineOutline" size="large" />
        <p>{{ error }}</p>
        <ion-button @click="cargar(true)">Reintentar</ion-button>
      </div>

      <!-- Estado vacío -->
      <div v-else-if="!cargando && equipos.length === 0" class="estado-vacio ion-padding ion-text-center">
        <ion-icon :icon="searchOutline" size="large" />
        <p>No se encontraron equipos.</p>
      </div>

      <!-- Listado + deslizamiento para eliminar -->
      <ion-list v-else lines="full">
        <ion-item-sliding v-for="equipo in equipos" :key="equipo.id">
          <ion-item button @click="irAEditar(equipo.id)">
            <ion-label>
              <h2>{{ equipo.nombre }}</h2>
              <p>{{ equipo.codigo }} · {{ equipo.categoria?.nombre ?? 'Sin categoría' }}</p>
            </ion-label>
            <ion-badge slot="end" :color="colorEstado[equipo.estado]">{{ equipo.estado }}</ion-badge>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" @click="confirmarEliminacion(equipo, $event)">
              <ion-icon slot="start" :icon="trashOutline" />
              Eliminar
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <ion-infinite-scroll :disabled="!hayMas" @ionInfinite="cargarMas">
        <ion-infinite-scroll-content loading-text="Cargando más equipos..." />
      </ion-infinite-scroll>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonSearchbar, IonContent,
  IonRefresher, IonRefresherContent, IonList, IonItem, IonLabel, IonSkeletonText, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonInfiniteScroll, IonInfiniteScrollContent,
  alertController, onIonViewWillEnter, useIonRouter,
} from '@ionic/vue';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/vue';
import { add, cloudOfflineOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { eliminar, listar, type Equipo, type Estado } from '@/services/equipos';
import { ErrorApi } from '@/services/errores';
import { mostrarToast } from '@/services/avisos';
import { useConexion, vibrar } from '@/composables/useConexion';

const colorEstado: Record<Estado, string> = { disponible: 'success', prestado: 'warning', mantenimiento: 'medium' };

const { conectado } = useConexion();
const ionRouter = useIonRouter();

const equipos = ref<Equipo[]>([]);
const pagina = ref(0);
const ultimaPagina = ref(1);
const q = ref('');
const cargando = ref(false);
const error = ref('');
const hayMas = computed(() => pagina.value < ultimaPagina.value);

function irAEditar(equipoId: number) {
  ionRouter.push(`/tabs/equipos/${equipoId}/editar`);
}

async function cargar(reiniciar = false) {
  if (cargando.value) return;

  const siguientePagina = reiniciar ? 1 : pagina.value + 1;
  if (!reiniciar && siguientePagina > ultimaPagina.value) return;

  cargando.value = true;
  if (reiniciar) {
    error.value = '';
  }

  try {
    const respuesta = await listar(siguientePagina, q.value.trim());
    equipos.value = reiniciar ? respuesta.data : [...equipos.value, ...respuesta.data];
    pagina.value = respuesta.meta.current_page;
    ultimaPagina.value = respuesta.meta.last_page;
  } catch (err) {
    const mensaje = err instanceof ErrorApi ? err.message : 'No fue posible cargar los equipos.';
    if (reiniciar || equipos.value.length === 0) {
      error.value = mensaje;
    } else {
      await mostrarToast(mensaje, 'danger');
    }
  } finally {
    cargando.value = false;
  }
}

onIonViewWillEnter(() => {
  cargar(true);
});

const buscar = () => cargar(true);

async function refrescar(evento: RefresherCustomEvent) {
  try {
    await cargar(true);
  } finally {
    evento.target.complete();
  }
}

async function cargarMas(evento: InfiniteScrollCustomEvent) {
  try {
    await cargar(false);
  } finally {
    evento.target.complete();
  }
}

async function confirmarEliminacion(equipo: Equipo, evento: Event) {
  const sliding = (evento.target as HTMLElement | null)?.closest('ion-item-sliding') as
    | (HTMLElement & { close?: () => Promise<void> })
    | null;
  await sliding?.close?.();

  const alerta = await alertController.create({
    header: 'Eliminar equipo',
    message: `¿Desea eliminar "${equipo.nombre}" (${equipo.codigo})?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { text: 'Eliminar', role: 'destructive' },
    ],
  });

  await alerta.present();
  const { role } = await alerta.onDidDismiss();
  if (role !== 'destructive') return;

  try {
    await eliminar(equipo.id);
    equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
    await vibrar();
    await mostrarToast('Equipo eliminado correctamente.', 'success');
  } catch (err) {
    if (err instanceof ErrorApi) {
      if (err.status === 409) {
        await mostrarToast(err.message || 'No se puede eliminar un equipo prestado.', 'warning');
      } else if (err.status === 404) {
        equipos.value = equipos.value.filter((item) => item.id !== equipo.id);
        await mostrarToast('El equipo ya no existe.', 'warning');
      } else {
        await mostrarToast(err.message || 'No se pudo eliminar el equipo.', 'danger');
      }
    } else {
      await mostrarToast('No se pudo eliminar el equipo.', 'danger');
    }
  }
}
</script>