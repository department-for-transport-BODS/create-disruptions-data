import { z } from "zod";

const makeArray = <T>(item: T | T[]) => (Array.isArray(item) ? item : [item]);

const adminAreaSchema = z
    .object({
        AdministrativeAreaCode: z.string(),
        AtcoAreaCode: z.string(),
        Name: z.string(),
        ShortName: z.string(),
    })
    .transform((item) => ({
        administrativeAreaCode: item.AdministrativeAreaCode,
        atcoAreaCode: item.AtcoAreaCode,
        name: item.Name,
        shortName: item.ShortName,
    }));

const regionSchema = z.object({
    AdministrativeAreas: z.object({
        AdministrativeArea: z.union([z.array(adminAreaSchema), adminAreaSchema]).transform(makeArray),
    }),
});

const hasAttr = (item: { $: Record<string, unknown> } | string): item is { $: Record<string, unknown> } =>
    !!(item as { $: Record<string, unknown> }).$;

const localitiesQualifySchema = z.object({
    QualifierName: z
        .union([
            z.object({
                $: z.object({
                    "xml:lang": z.string(),
                }),
                _: z.string(),
            }),
            z.string(),
        ])
        .transform((item) => ({
            $: {
                "xml:lang": hasAttr(item) ? item.$["xml:lang"] : null,
            },
            _: hasAttr(item) ? item._ : item,
        }))
        .optional(),
});

const localitiesDescriptorSchema = z.object({
    LocalityName: z.object({
        $: z.object({
            "xml:lang": z.string(),
        }),
        _: z.string(),
    }),
    ShortName: z.string().optional(),
    Qualify: localitiesQualifySchema.optional(),
});

const localitiesSchema = z.object({
    $: z.object({
        CreationDateTime: z.string(),
        ModificationDateTime: z.string(),
        RevisionNumber: z.coerce.number(),
        Modification: z.string(),
    }),
    NptgLocalityCode: z.string(),
    Descriptor: localitiesDescriptorSchema,
    ParentNptgLocalityRef: z
        .object({
            _: z.string(),
        })
        .optional(),
    AdministrativeAreaRef: z.string(),
    NptgDistrictRef: z.string().nullish(),
    SourceLocalityType: z.string(),
    Location: z.object({
        Translation: z.object({
            Easting: z.coerce.number(),
            Northing: z.coerce.number(),
        }),
    }),
});

export const nptgSchema = z
    .object({
        NationalPublicTransportGazetteer: z.object({
            Regions: z.object({
                Region: z.array(regionSchema),
            }),
            NptgLocalities: z.object({
                NptgLocality: z.array(localitiesSchema),
            }),
        }),
    })
    .transform((item) => ({
        adminAreas: item.NationalPublicTransportGazetteer.Regions.Region.flatMap(
            (region) => region.AdministrativeAreas.AdministrativeArea,
        ),
        localities: item.NationalPublicTransportGazetteer.NptgLocalities.NptgLocality.flatMap((locality) => ({
            nptgLocalityCode: locality.NptgLocalityCode,
            localityName: locality.Descriptor.LocalityName._,
            localityNameLang: locality.Descriptor.LocalityName.$["xml:lang"],
            shortName: locality.Descriptor.ShortName ?? null,
            shortNameLang: null,
            qualifierName: locality.Descriptor.Qualify?.QualifierName?._ ?? null,
            qualifierNameLang: locality.Descriptor.Qualify?.QualifierName?.$["xml:lang"] ?? null,
            qualifierLocalityRef: null,
            qualifierDistrictRef: null,
            parentLocalityRef: locality.ParentNptgLocalityRef?._,
            administrativeAreaCode: locality.AdministrativeAreaRef,
            nptgDistrictCode: locality.NptgDistrictRef ?? null,
            sourceLocalityType: locality.SourceLocalityType,
            gridType: null,
            easting: locality.Location.Translation.Easting,
            northing: locality.Location.Translation.Northing,
            creationDateTime: locality.$.CreationDateTime,
            modificationDateTime: locality.$.ModificationDateTime,
            revisionNumber: locality.$.RevisionNumber,
            modification: locality.$.Modification,
        })),
    }));

export type Nptg = z.infer<typeof nptgSchema>;
