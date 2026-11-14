import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableHead,
  TableRow, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, CircularProgress, Alert, Snackbar, MenuItem,
  Chip, Tabs, Tab, Stack, Collapse, InputAdornment, Tooltip, Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  SubdirectoryArrowRight as SubIcon,
  Folder as FolderIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  AccountTree as TreeIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import api from '../api/client';
import type { Category } from '@ornate/types';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [parentId, setParentId] = useState('');
  const [filterTab, setFilterTab] = useState<'tree' | 'root' | 'sub'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoots, setExpandedRoots] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // Custom confirmation dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    categoryId: string | null;
    categoryName: string;
  }>({
    open: false,
    categoryId: null,
    categoryName: '',
  });

  // Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setToast({ open: true, message, severity });
  };

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/categories');
        const list = data?.data?.categories || data?.data || data || [];
        if (Array.isArray(list) && list.length > 0) return list;
      } catch {
        // try admin route
      }
      try {
        const { data } = await api.get('/admin/categories');
        const list = data?.data?.categories || data?.data || data || [];
        if (Array.isArray(list)) return list;
      } catch {
        // ignore
      }
      return [];
    },
  });

  // Organize into Root Categories and Children Subcategories
  const { rootCategories, subcategoriesByParent, allSubcategories, parentMap } = useMemo(() => {
    const all = categories || [];
    const roots: Category[] = [];
    const subs: Category[] = [];
    const subMap = new Map<string, Category[]>();
    const pMap = new Map<string, string>();

    for (const cat of all) {
      const pId = String(cat.parent || cat.parentId || '');
      if (!pId) {
        roots.push(cat);
        pMap.set(String(cat.id || (cat as any)._id), cat.name);
      } else {
        subs.push(cat);
        if (!subMap.has(pId)) subMap.set(pId, []);
        subMap.get(pId)!.push(cat);
      }
    }

    // Sort roots by order then name
    roots.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

    // Sort subs by order then name
    for (const [_, subList] of subMap.entries()) {
      subList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    }

    return {
      rootCategories: roots,
      subcategoriesByParent: subMap,
      allSubcategories: subs,
      parentMap: pMap,
    };
  }, [categories]);

  // Filtering based on search query
  const query = searchQuery.trim().toLowerCase();

  const filteredRoots = useMemo(() => {
    if (!query) return rootCategories;
    return rootCategories.filter((rc) => {
      const rcId = String(rc.id || (rc as any)._id);
      const matchesSelf =
        rc.name.toLowerCase().includes(query) || rc.slug.toLowerCase().includes(query);
      const subs = subcategoriesByParent.get(rcId) || [];
      const matchesAnySub = subs.some(
        (s) => s.name.toLowerCase().includes(query) || s.slug.toLowerCase().includes(query)
      );
      return matchesSelf || matchesAnySub;
    });
  }, [rootCategories, subcategoriesByParent, query]);

  const filteredAllSubcategories = useMemo(() => {
    if (!query) return allSubcategories;
    return allSubcategories.filter((s) => {
      const pId = String(s.parent || s.parentId || '');
      const pName = parentMap.get(pId) || '';
      return (
        s.name.toLowerCase().includes(query) ||
        s.slug.toLowerCase().includes(query) ||
        pName.toLowerCase().includes(query)
      );
    });
  }, [allSubcategories, parentMap, query]);

  // Toggle single root expansion (defaults to true if undefined)
  const isRootExpanded = (rootId: string) => {
    return expandedRoots[rootId] !== false; // default open
  };

  const toggleRootExpanded = (rootId: string) => {
    setExpandedRoots((prev) => ({
      ...prev,
      [rootId]: prev[rootId] === false ? true : false,
    }));
  };

  const handleExpandAll = () => {
    const updated: Record<string, boolean> = {};
    for (const rc of rootCategories) {
      updated[String(rc.id || (rc as any)._id)] = true;
    }
    setExpandedRoots(updated);
  };

  const handleCollapseAll = () => {
    const updated: Record<string, boolean> = {};
    for (const rc of rootCategories) {
      updated[String(rc.id || (rc as any)._id)] = false;
    }
    setExpandedRoots(updated);
  };

  // Open modal pre-selected to add subcategory under specific parent
  const handleOpenAddSubcategory = (targetParentId: string) => {
    setError(null);
    setIsSubcategory(true);
    setParentId(targetParentId);
    setName('');
    setDescription('');
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        parent: isSubcategory && parentId ? parentId : null,
      };
      await api.post('/admin/categories', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDialogOpen(false);
      setName('');
      setDescription('');
      setIsSubcategory(false);
      setParentId('');
      setError(null);
      showToast('Category created successfully!', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || 'Failed to create category';
      setError(msg);
      showToast(msg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDeleteConfirmDialog({ open: false, categoryId: null, categoryName: '' });
      showToast('Category deleted successfully', 'success');
    },
    onError: (err: any) => {
      showToast(err.response?.data?.error?.message || 'Failed to delete category', 'error');
    },
  });

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', pb: 6 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" fontWeight={900} letterSpacing="-0.02em" sx={{ color: '#0F172A' }}>
              Category & Subcategory Hierarchy
            </Typography>
            <Chip
              label={`${rootCategories.length} Departments • ${allSubcategories.length} Subcategories`}
              size="small"
              sx={{ bgcolor: '#FFF7ED', color: '#FF7900', fontWeight: 800, fontSize: '0.75rem' }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5 }}>
            Manage departmental hierarchy, assign subcategories to stores, and organize catalog stock routing.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setError(null);
            setIsSubcategory(false);
            setParentId(rootCategories[0]?.id || (rootCategories[0] as any)?._id || '');
            setName('');
            setDescription('');
            setDialogOpen(true);
          }}
          sx={{
            borderRadius: '8px',
            fontWeight: 800,
            bgcolor: '#FF7900',
            px: 2.5,
            py: 1,
            '&:hover': { bgcolor: '#E85D04' },
          }}
        >
          Add Category / Subcategory
        </Button>
      </Box>

      {/* Control Bar: Filter Tabs & Live Search */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 1.5,
          borderRadius: 3,
          border: '1px solid #E2E8F0',
          bgcolor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Tabs
          value={filterTab}
          onChange={(_, val) => setFilterTab(val)}
          sx={{
            '& .MuiTab-root': { fontWeight: 800, textTransform: 'none', fontSize: '0.875rem', minHeight: 42 },
            '& .Mui-selected': { color: '#FF7900' },
            '& .MuiTabs-indicator': { bgcolor: '#FF7900', height: 3, borderRadius: '2px 2px 0 0' },
          }}
        >
          <Tab
            value="tree"
            icon={<TreeIcon fontSize="small" />}
            iconPosition="start"
            label={`Hierarchical Tree (${rootCategories.length} Departments)`}
          />
          <Tab
            value="root"
            icon={<FolderIcon fontSize="small" />}
            iconPosition="start"
            label={`Main Categories Only (${rootCategories.length})`}
          />
          <Tab
            value="sub"
            icon={<SubIcon fontSize="small" />}
            iconPosition="start"
            label={`All Subcategories (${allSubcategories.length})`}
          />
        </Tabs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {filterTab === 'tree' && (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Expand all main categories">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UnfoldMoreIcon fontSize="small" />}
                  onClick={handleExpandAll}
                  sx={{ color: '#64748B', borderColor: '#E2E8F0', fontWeight: 700, fontSize: '0.75rem' }}
                >
                  Expand All
                </Button>
              </Tooltip>
              <Tooltip title="Collapse all main categories">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UnfoldLessIcon fontSize="small" />}
                  onClick={handleCollapseAll}
                  sx={{ color: '#64748B', borderColor: '#E2E8F0', fontWeight: 700, fontSize: '0.75rem' }}
                >
                  Collapse All
                </Button>
              </Tooltip>
            </Stack>
          )}

          <TextField
            size="small"
            placeholder="Search categories or subcategories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 280 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#94A3B8' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Paper>

      {/* Main Content Area */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress sx={{ color: '#FF7900' }} />
        </Box>
      ) : filterTab === 'tree' ? (
        /* ========================================================================= */
        /* TAB 1: HIERARCHICAL TREE VIEW (Grouped by Parent Category)                 */
        /* ========================================================================= */
        <Stack spacing={2.5}>
          {filteredRoots.length === 0 ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px solid #E2E8F0', color: '#94A3B8' }}>
              <CategoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
              <Typography variant="body1" fontWeight={700}>
                {searchQuery ? `No categories found matching "${searchQuery}"` : 'No categories found.'}
              </Typography>
            </Paper>
          ) : (
            filteredRoots.map((root) => {
              const rootId = String(root.id || (root as any)._id);
              const subs = subcategoriesByParent.get(rootId) || [];
              const isExpanded = isRootExpanded(rootId);

              // Filter subcategories if search is active
              const displayedSubs = query
                ? subs.filter(
                    (s) =>
                      s.name.toLowerCase().includes(query) ||
                      s.slug.toLowerCase().includes(query) ||
                      root.name.toLowerCase().includes(query)
                  )
                : subs;

              return (
                <Paper
                  key={rootId}
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid #E2E8F0',
                    bgcolor: '#FFFFFF',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: '#CBD5E1',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    },
                  }}
                >
                  {/* Root Category Header Card */}
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#F8FAFC',
                      borderBottom: isExpanded ? '1px solid #E2E8F0' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 280 }}>
                      <IconButton
                        size="small"
                        onClick={() => toggleRootExpanded(rootId)}
                        sx={{
                          color: '#475569',
                          bgcolor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          '&:hover': { bgcolor: '#F1F5F9' },
                        }}
                      >
                        {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                      </IconButton>

                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          bgcolor: '#FFF7ED',
                          color: '#FF7900',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FolderIcon fontSize="small" />
                      </Box>

                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0F172A' }}>
                            {root.name}
                          </Typography>
                          <Chip
                            label={`slug: ${root.slug}`}
                            size="small"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              height: 20,
                              bgcolor: '#F1F5F9',
                              color: '#475569',
                              fontWeight: 700,
                            }}
                          />
                          <Chip
                            label={`${subs.length} Subcategor${subs.length === 1 ? 'y' : 'ies'}`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              bgcolor: subs.length > 0 ? '#EEF2FF' : '#F1F5F9',
                              color: subs.length > 0 ? '#4F46E5' : '#64748B',
                            }}
                          />
                        </Box>
                        {root.description && (
                          <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.25 }}>
                            {root.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Quick Parent Actions */}
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<AddIcon fontSize="small" />}
                        onClick={() => handleOpenAddSubcategory(rootId)}
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          bgcolor: '#4F46E5',
                          borderRadius: '6px',
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#4338CA' },
                        }}
                      >
                        Add Subcategory
                      </Button>

                      <Tooltip title="Delete Main Category (and unlink children)">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteConfirmDialog({
                              open: true,
                              categoryId: rootId,
                              categoryName: root.name,
                            });
                          }}
                          sx={{ border: '1px solid #FECACA', bgcolor: '#FEF2F2' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>

                  {/* Collapsible Subcategories Table */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    {displayedSubs.length === 0 ? (
                      <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#FAFAFA' }}>
                        <Typography variant="body2" sx={{ color: '#94A3B8', fontStyle: 'italic', mb: 1 }}>
                          No subcategories nested under {root.name} yet.
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddIcon fontSize="small" />}
                          onClick={() => handleOpenAddSubcategory(rootId)}
                          sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#4F46E5', borderColor: '#CBD5E1' }}
                        >
                          Create First Subcategory
                        </Button>
                      </Box>
                    ) : (
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#FDFEFE' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800, color: '#475569', pl: 6 }}>Subcategory Name</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Slug</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right', pr: 3 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {displayedSubs.map((sub, idx) => {
                            const subId = String(sub.id || (sub as any)._id);
                            return (
                              <TableRow key={subId} hover sx={{ bgcolor: idx % 2 === 0 ? '#FFFFFF' : '#FBFBFD' }}>
                                <TableCell sx={{ pl: 6 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <SubIcon sx={{ color: '#94A3B8', fontSize: 18 }} />
                                    <Box>
                                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                                        {sub.name}
                                      </Typography>
                                      <Chip
                                        label="Subcategory"
                                        size="small"
                                        sx={{
                                          height: 16,
                                          fontSize: '0.6rem',
                                          fontWeight: 800,
                                          bgcolor: '#EEF2FF',
                                          color: '#4F46E5',
                                          mt: 0.25,
                                        }}
                                      />
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748B' }}>
                                  {sub.slug}
                                </TableCell>
                                <TableCell sx={{ color: '#64748B', fontSize: '0.82rem', maxWidth: 420 }}>
                                  {sub.description || '—'}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', pr: 3 }}>
                                  <Tooltip title="Delete Subcategory">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => {
                                        setDeleteConfirmDialog({
                                          open: true,
                                          categoryId: subId,
                                          categoryName: `${sub.name} (under ${root.name})`,
                                        });
                                      }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </Collapse>
                </Paper>
              );
            })
          )}
        </Stack>
      ) : filterTab === 'root' ? (
        /* ========================================================================= */
        /* TAB 2: ROOT MAIN CATEGORIES ONLY                                          */
        /* ========================================================================= */
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden', bgcolor: '#FFFFFF' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Main Department</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Slug</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Nested Subcategories</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRoots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: '#94A3B8' }}>
                    No main categories found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoots.map((root) => {
                  const rootId = String(root.id || (root as any)._id);
                  const subs = subcategoriesByParent.get(rootId) || [];
                  return (
                    <TableRow key={rootId} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: '#FFF7ED', color: '#FF7900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FolderIcon fontSize="small" />
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0F172A' }}>
                              {root.name}
                            </Typography>
                            <Chip label="Main Category" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: '#FFF7ED', color: '#EA580C', mt: 0.25 }} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748B' }}>
                        {root.slug}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${subs.length} Subcategories`}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#EEF2FF', color: '#4F46E5' }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#64748B', fontSize: '0.85rem', maxWidth: 360 }}>
                        {root.description || '—'}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <Button
                          size="small"
                          startIcon={<AddIcon fontSize="small" />}
                          onClick={() => handleOpenAddSubcategory(rootId)}
                          sx={{ mr: 1, fontWeight: 700, color: '#4F46E5', textTransform: 'none' }}
                        >
                          + Subcategory
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteConfirmDialog({
                              open: true,
                              categoryId: rootId,
                              categoryName: root.name,
                            });
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      ) : (
        /* ========================================================================= */
        /* TAB 3: ALL SUBCATEGORIES FLAT LIST                                        */
        /* ========================================================================= */
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', overflow: 'hidden', bgcolor: '#FFFFFF' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Subcategory Name</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Parent Department</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Slug</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 800, color: '#475569', textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAllSubcategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: '#94A3B8' }}>
                    No subcategories found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAllSubcategories.map((sub) => {
                  const subId = String(sub.id || (sub as any)._id);
                  const pId = String(sub.parent || sub.parentId || '');
                  const parentName = parentMap.get(pId) || (sub.ancestors?.[0]?.name) || 'Unknown Parent';

                  return (
                    <TableRow key={subId} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <SubIcon fontSize="small" />
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0F172A' }}>
                              {sub.name}
                            </Typography>
                            <Chip label="Subcategory" size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800, bgcolor: '#EEF2FF', color: '#4F46E5', mt: 0.25 }} />
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={parentName}
                          size="small"
                          sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: '#FFF7ED', color: '#FF7900', border: '1px solid #FED7AA' }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748B' }}>
                        {sub.slug}
                      </TableCell>
                      <TableCell sx={{ color: '#64748B', fontSize: '0.85rem', maxWidth: 360 }}>
                        {sub.description || '—'}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'right' }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setDeleteConfirmDialog({
                              open: true,
                              categoryId: subId,
                              categoryName: `${sub.name} (under ${parentName})`,
                            });
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add Category / Subcategory Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Add Category / Subcategory</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', textTransform: 'uppercase', mb: 1, display: 'block' }}>
              Taxonomy Level
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Button
                variant={!isSubcategory ? 'contained' : 'outlined'}
                onClick={() => setIsSubcategory(false)}
                sx={{
                  flex: 1,
                  borderRadius: '8px',
                  fontWeight: 700,
                  bgcolor: !isSubcategory ? '#FF7900' : 'transparent',
                  color: !isSubcategory ? '#FFFFFF' : '#64748B',
                  borderColor: '#E2E8F0',
                  '&:hover': { bgcolor: !isSubcategory ? '#E85D04' : '#F8FAFC' },
                }}
              >
                Main Category
              </Button>
              <Button
                variant={isSubcategory ? 'contained' : 'outlined'}
                onClick={() => setIsSubcategory(true)}
                disabled={rootCategories.length === 0}
                sx={{
                  flex: 1,
                  borderRadius: '8px',
                  fontWeight: 700,
                  bgcolor: isSubcategory ? '#4F46E5' : 'transparent',
                  color: isSubcategory ? '#FFFFFF' : '#64748B',
                  borderColor: '#E2E8F0',
                  '&:hover': { bgcolor: isSubcategory ? '#4338CA' : '#F8FAFC' },
                }}
              >
                Nested Subcategory
              </Button>
            </Stack>
          </Box>

          {isSubcategory && (
            <TextField
              select
              label="Select Parent Category"
              required
              fullWidth
              size="small"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              sx={{ mb: 2 }}
              helperText="Stores will be assigned to this specific subcategory"
            >
              {rootCategories.map((rc) => (
                <MenuItem key={rc.id || (rc as any)._id} value={rc.id || (rc as any)._id}>
                  {rc.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label={isSubcategory ? 'Subcategory Name' : 'Main Category Name'}
            required
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
            placeholder={isSubcategory ? 'e.g. Smartphones, Audio, Sneakers' : 'e.g. Electronics, Grocery, Fashion'}
          />

          <TextField
            label="Description (Optional)"
            fullWidth
            size="small"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of products belonging to this category..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={createMutation.isPending || !name.trim() || (isSubcategory && !parentId)}
            onClick={() => createMutation.mutate()}
            sx={{
              fontWeight: 800,
              borderRadius: '8px',
              bgcolor: isSubcategory ? '#4F46E5' : '#FF7900',
              '&:hover': { bgcolor: isSubcategory ? '#4338CA' : '#E85D04' },
            }}
          >
            {createMutation.isPending ? 'Saving...' : isSubcategory ? 'Create Subcategory' : 'Create Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.open}
        onClose={() => setDeleteConfirmDialog({ open: false, categoryId: null, categoryName: '' })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1, color: '#0F172A' }}>
          Delete Category
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete category <strong>{deleteConfirmDialog.categoryName}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setDeleteConfirmDialog({ open: false, categoryId: null, categoryName: '' })}
            sx={{ fontWeight: 700, color: '#64748B' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteConfirmDialog.categoryId) {
                deleteMutation.mutate(deleteConfirmDialog.categoryId);
              }
            }}
            sx={{ fontWeight: 800, borderRadius: '8px', px: 2.5 }}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{
            fontWeight: 700,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            alignItems: 'center',
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
