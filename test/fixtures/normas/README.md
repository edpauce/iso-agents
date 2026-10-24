# Fixtures normativos (sintéticos)

Los tests de `normas.ts` corren contra esta carpeta, no contra `normas/`.
Son **sustitutos de prueba**: conservan la estructura que el cargador espera
(encabezado `## <código> <título oficial>` y una o dos frases clave por
requisito) pero **no reproducen el texto de las normas ISO**, que tiene
derechos de autor y no se versiona en este repositorio.
