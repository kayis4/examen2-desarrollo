import { onUnmounted, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * TODO [M7] Capacidades nativas (6 pts en total: este archivo, PerfilPage.vue y AndroidManifest.xml).
 *
 * useConexion() devuelve { conectado, tipo }:
 *   - Valor inicial con Network.getStatus()                       (@capacitor/network)
 *   - Se actualiza solo con Network.addListener('networkStatusChange', ...)
 *   - El oyente se libera (handle.remove()) cuando se destruye la página que lo usa (onUnmounted).
 *   Las páginas Equipos y Formulario ya muestran el aviso "Sin conexión" y deshabilitan Guardar con `conectado`.
 */
export function useConexion() {
  const conectado = ref(true);
  const tipo = ref('unknown');

  Network.getStatus()
    .then((estado) => {
      conectado.value = estado.connected;
      tipo.value = estado.connectionType;
    })
    .catch(() => {
      // Mantener valores por defecto si el plugin no está disponible
    });

  const listenerPromesa = Network.addListener('networkStatusChange', (estado) => {
    conectado.value = estado.connected;
    tipo.value = estado.connectionType;
  });

  onUnmounted(() => {
    listenerPromesa
      .then((handle) => handle.remove())
      .catch(() => {
        // Ignorar si ya fue removido
      });
  });

  return { conectado, tipo };
}

/**
 * TODO [M7] vibrar(): vibración breve de confirmación con Haptics.impact({ style: ImpactStyle.Light })
 *   (@capacitor/haptics). En el navegador NO debe hacer nada: use Capacitor.isNativePlatform().
 *   Se llama después de guardar y de eliminar con éxito.
 */
export async function vibrar() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  await Haptics.impact({ style: ImpactStyle.Light });
}