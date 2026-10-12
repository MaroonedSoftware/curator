import { Group, Text, Tooltip } from '@mantine/core';
import { categoryLabel } from '../../api/category.labels';

/** Every category a piece is in, by name, with the TV's own id on hover. */
export function CategoryLabels({ categoryIds }: { categoryIds: string[] }) {
    return (
        <Group gap={6}>
            {categoryIds.map((categoryId, index) => (
                <Tooltip key={categoryId} label={categoryId} withinPortal={false}>
                    <Text span size="sm" title={categoryId}>
                        {categoryLabel(categoryId)}
                        {index < categoryIds.length - 1 ? ',' : ''}
                    </Text>
                </Tooltip>
            ))}
        </Group>
    );
}
