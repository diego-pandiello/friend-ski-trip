# Functional requirements

- Una pantalla de admin para poder crear/editar/borrar viajes.
- Un viaje consiste en un titulo, una fecha, una descripcion, numero de viajeros y una foto
- Solo los admins pueden administrar viajes. De momento habra un unico usuario admin hardcode en el codigo
- La landing the permite seleccionar el viaje cuando aterrizas (si hay un solo viaje se selecciona por defecto)
- La landing te permite seleccionar tu nombre de la lista de personas incritas en el viaje o introducir un nombre nuevo si no apareces
- Una vez en el viaje se muestra la informacion de las diferentes opciones
- Una opcion consiste en un destino. Cada destino puede contener varios alojamientos
- Un destino consiste en un link de google maps al destino, tiempo de viaje en coche desde el origen (Gijon, Asturias) y precio del forfait para los dias del viaje
- Un alojamiento consiste en una descripcion, numero de camas, numero de habitaciones, numero de banos, distancia a pistas y precio por persona
- En la pagina de desitno se lista el precio total para cada combinacion de forfait de destino mas alojamiento
- Cualquier persona puede crear un nuevo destino en el viaje
- Cualquier persona puede anadir un alojamiento a un destino ya existente
- En la pagina del viaje se resumen los diferentes destinos con los rangos de de precios y las distancias
- Para crear un alojameinto se pide un link de booking.com o airbnb. Se pega el link y un proceso en background extrae la informacion del link para completar el modelo de datos de alojamiento
- Para crear un destino se pide un link de google map al destino y un link de una web con el precio del forfait. UN proceso en background se encarga de extraer la info necesaria para crear el modelo de datos de destino.
- Ambos procesos de extraccion de datos (alojamiento y destino) usaran una integracion de IA de claude
