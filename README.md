# Gestión Lecturas Agua

Aplicación móvil React Native para gestión de lecturas de contadores de agua con funcionalidad offline.

## Características

- 📊 Gestión de incidencias
- 🔢 Lectura de contadores
- 📱 Funcionalidad offline
- 🔄 Sincronización automática de datos
- 🌐 Indicador de estado de red
- 🎨 Temas personalizables

## Tecnologías

- React Native
- TypeScript
- SQLite (react-native-sqlite-storage)
- React Navigation
- React Native Paper
- NetInfo

## Instalación

```bash
# Clonar repositorio
git clone https://github.com/pjnoguerollynx/GestionLecturasAgua.git
cd GestionLecturasAgua

# Instalar dependencias
npm install

# Para Android
npx react-native run-android

# Para iOS
npx react-native run-ios
```

## Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
├── database/           # Repositorios y modelos de BD
├── navigation/         # Configuración de navegación
├── screens/           # Pantallas de la aplicación
├── services/          # Servicios (BD, red, etc.)
├── theme/            # Configuración de temas
└── types/            # Definiciones de tipos TypeScript
```

## Estado del Proyecto

✅ Base de datos SQLite configurada  
✅ Datos de prueba insertados  
✅ Indicador de estado de red  
✅ Sistema de temas  
✅ Repositorio Git configurado  
⚠️ En desarrollo activo  

## Desarrollo

El proyecto incluye datos de prueba que se insertan automáticamente al inicializar la base de datos. Para desarrollo, la app funciona completamente offline con SQLite local.

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request
